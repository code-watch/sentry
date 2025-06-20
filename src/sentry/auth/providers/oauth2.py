import abc
import logging
import secrets
from collections.abc import Mapping
from time import time
from typing import Any
from urllib.parse import parse_qsl, urlencode

import orjson
from django.http import HttpRequest, HttpResponse
from django.http.response import HttpResponseRedirect
from django.urls import reverse

from sentry.auth.exceptions import IdentityNotValid
from sentry.auth.provider import Provider
from sentry.auth.view import AuthView
from sentry.http import safe_urlopen, safe_urlread
from sentry.models.authidentity import AuthIdentity
from sentry.utils.http import absolute_uri

ERR_INVALID_STATE = "An error occurred while validating your request."


def _get_redirect_url() -> str:
    return absolute_uri(reverse("sentry-auth-sso"))


class OAuth2Login(AuthView):
    authorize_url: str | None = None
    client_id: str | None = None
    scope = ""

    def __init__(self, authorize_url=None, client_id=None, scope=None, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        if authorize_url is not None:
            self.authorize_url = authorize_url
        if client_id is not None:
            self.client_id = client_id
        if scope is not None:
            self.scope = scope

    def get_scope(self) -> str:
        return self.scope

    def get_authorize_url(self) -> str | None:
        return self.authorize_url

    def get_authorize_params(self, state: str, redirect_uri: str) -> dict[str, str | None]:
        return {
            "client_id": self.client_id,
            "response_type": "code",
            "scope": self.get_scope(),
            "state": state,
            "redirect_uri": redirect_uri,
        }

    def dispatch(self, request: HttpRequest, pipeline) -> HttpResponse:
        if "code" in request.GET:
            return pipeline.next_step()

        state = secrets.token_hex()

        params = self.get_authorize_params(state=state, redirect_uri=_get_redirect_url())
        authorization_url = f"{self.get_authorize_url()}?{urlencode(params)}"

        pipeline.bind_state("state", state)
        if request.subdomain:
            pipeline.bind_state("subdomain", request.subdomain)

        return HttpResponseRedirect(authorization_url)


class OAuth2Callback(AuthView):
    access_token_url: str | None = None
    client_id: str | None = None
    client_secret: str | None = None

    def __init__(
        self, access_token_url=None, client_id=None, client_secret=None, *args, **kwargs
    ) -> None:
        super().__init__(*args, **kwargs)
        if access_token_url is not None:
            self.access_token_url = access_token_url
        if client_id is not None:
            self.client_id = client_id
        if client_secret is not None:
            self.client_secret = client_secret

    def get_token_params(self, code: str, redirect_uri: str) -> dict[str, str | None]:
        return {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }

    def exchange_token(self, request: HttpRequest, pipeline, code: str):
        # TODO: this needs the auth yet
        data = self.get_token_params(code=code, redirect_uri=_get_redirect_url())
        req = safe_urlopen(self.access_token_url, data=data)
        body = safe_urlread(req)
        if req.headers["Content-Type"].startswith("application/x-www-form-urlencoded"):
            return dict(parse_qsl(body))
        return orjson.loads(body)

    def dispatch(self, request: HttpRequest, pipeline) -> HttpResponse:
        error = request.GET.get("error")
        state = request.GET.get("state")
        code = request.GET.get("code")

        if error:
            return pipeline.error(error)

        if state != pipeline.fetch_state("state"):
            return pipeline.error(ERR_INVALID_STATE)

        if code is None:
            return pipeline.error("no code was provided")

        data = self.exchange_token(request, pipeline, code)

        if "error_description" in data:
            return pipeline.error(data["error_description"])

        if "error" in data:
            logging.info("Error exchanging token: %s", data["error"])
            return pipeline.error("Unable to retrieve your token")

        # we can either expect the API to be implicit and say "im looking for
        # blah within state data" or we need to pass implementation + call a
        # hook here
        pipeline.bind_state("data", data)

        return pipeline.next_step()


class OAuth2Provider(Provider, abc.ABC):
    is_partner = False

    @abc.abstractmethod
    def get_client_id(self) -> str:
        raise NotImplementedError

    @abc.abstractmethod
    def get_client_secret(self) -> str:
        raise NotImplementedError

    def get_auth_pipeline(self) -> list[AuthView]:
        return [
            OAuth2Login(client_id=self.get_client_id()),
            OAuth2Callback(client_id=self.get_client_id(), client_secret=self.get_client_secret()),
        ]

    @abc.abstractmethod
    def get_refresh_token_url(self) -> str:
        raise NotImplementedError

    def get_refresh_token_params(self, refresh_token: str) -> dict[str, str | None]:
        return {
            "client_id": self.get_client_id(),
            "client_secret": self.get_client_secret(),
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        }

    def get_oauth_data(self, payload):
        data = {"access_token": payload["access_token"], "token_type": payload["token_type"]}
        if "expires_in" in payload:
            data["expires"] = int(time()) + int(payload["expires_in"])
        if "refresh_token" in payload:
            data["refresh_token"] = payload["refresh_token"]
        return data

    @abc.abstractmethod
    def build_identity(self, state: Mapping[str, Any]) -> Mapping[str, Any]:
        """
        Example implementation:
        data = state['data']
        return {
            'id': '',
            'email': '',
            'name': '',
            'data': self.get_oauth_data(data),
        }
        """
        raise NotImplementedError

    def update_identity(self, new_data, current_data):
        # we want to maintain things like refresh_token that might not
        # exist on a refreshed state
        if "refresh_token" in current_data:
            new_data.setdefault("refresh_token", current_data["refresh_token"])
        return new_data

    def refresh_identity(self, auth_identity: AuthIdentity) -> None:
        refresh_token = auth_identity.data.get("refresh_token")

        if not refresh_token:
            raise IdentityNotValid("Missing refresh token")

        data = self.get_refresh_token_params(refresh_token=refresh_token)
        req = safe_urlopen(self.get_refresh_token_url(), data=data)

        try:
            body = safe_urlread(req)
            payload = orjson.loads(body)
        except Exception:
            payload = {}

        error = payload.get("error", "unknown_error")
        error_description = payload.get("error_description", "no description available")

        formatted_error = f"HTTP {req.status_code} ({error}): {error_description}"

        if req.status_code == 401:
            raise IdentityNotValid(formatted_error)

        if req.status_code == 400:
            # this may not be common, but at the very least Google will return
            # an invalid grant when a user is suspended
            if error == "invalid_grant":
                raise IdentityNotValid(formatted_error)

        if req.status_code != 200:
            raise Exception(formatted_error)

        auth_identity.data.update(self.get_oauth_data(payload))
        auth_identity.update(data=auth_identity.data)
