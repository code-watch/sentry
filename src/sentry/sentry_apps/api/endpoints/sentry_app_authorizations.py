import logging

import sentry_sdk
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.serializers.models.apitoken import ApiTokenSerializer
from sentry.auth.services.auth.impl import promote_request_api_user
from sentry.sentry_apps.api.bases.sentryapps import SentryAppAuthorizationsBaseEndpoint
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.token_exchange.grant_exchanger import GrantExchanger
from sentry.sentry_apps.token_exchange.refresher import Refresher
from sentry.sentry_apps.token_exchange.util import GrantTypes
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError

logger = logging.getLogger(__name__)


class SentryAppRefreshAuthorizationSerializer(serializers.Serializer):
    client_id = serializers.CharField(required=True, allow_null=False)
    refresh_token = serializers.CharField(required=True, allow_null=False)
    grant_type = serializers.CharField(required=True, allow_null=False)


class SentryAppAuthorizationSerializer(serializers.Serializer):
    client_id = serializers.CharField(required=True, allow_null=False)
    grant_type = serializers.CharField(required=True, allow_null=False)
    code = serializers.CharField(required=True, allow_null=False)


@control_silo_endpoint
class SentryAppAuthorizationsEndpoint(SentryAppAuthorizationsBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request, installation: SentryAppInstallation) -> Response:
        scope = sentry_sdk.get_isolation_scope()

        scope.set_tag("organization", installation.organization_id)
        scope.set_tag("sentry_app_id", installation.sentry_app.id)
        scope.set_tag("sentry_app_slug", installation.sentry_app.slug)

        try:
            if request.data.get("grant_type") == GrantTypes.AUTHORIZATION:
                auth_serializer: SentryAppAuthorizationSerializer = (
                    SentryAppAuthorizationSerializer(data=request.data)
                )

                if not auth_serializer.is_valid():
                    return Response(auth_serializer.errors, status=400)

                token = GrantExchanger(
                    install=installation,
                    code=auth_serializer.validated_data.get("code"),
                    client_id=auth_serializer.validated_data.get("client_id"),
                    user=promote_request_api_user(request),
                ).run()
            elif request.data.get("grant_type") == GrantTypes.REFRESH:
                refresh_serializer = SentryAppRefreshAuthorizationSerializer(data=request.data)

                if not refresh_serializer.is_valid():
                    return Response(refresh_serializer.errors, status=400)

                token = Refresher(
                    install=installation,
                    refresh_token=refresh_serializer.validated_data.get("refresh_token"),
                    client_id=refresh_serializer.validated_data.get("client_id"),
                    user=promote_request_api_user(request),
                ).run()
            else:
                raise SentryAppIntegratorError(message="Invalid grant_type", status_code=403)
        except SentryAppIntegratorError as e:
            logger.info(
                "sentry-app-authorizations.error-context",
                exc_info=e,
                extra={
                    "user_id": request.user.id,
                    "sentry_app_installation_id": installation.id,
                    "organization_id": installation.organization_id,
                    "sentry_app_id": installation.sentry_app.id,
                },
            )
            raise

        attrs = {"state": request.data.get("state"), "application": None}

        body = ApiTokenSerializer().serialize(token, attrs, promote_request_api_user(request))

        return Response(body, status=201)
