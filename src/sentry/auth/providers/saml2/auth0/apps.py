from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.auth.providers.saml2.auth0"

    def ready(self) -> None:
        from sentry.auth import register

        from .provider import Auth0SAML2Provider

        register(Auth0SAML2Provider)
