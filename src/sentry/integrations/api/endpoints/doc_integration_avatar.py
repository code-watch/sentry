from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.avatar import AvatarMixin
from sentry.integrations.api.bases.doc_integrations import DocIntegrationBaseEndpoint
from sentry.integrations.api.serializers.rest_framework.doc_integration import (
    DocIntegrationAvatarSerializer,
)
from sentry.integrations.models.doc_integration_avatar import DocIntegrationAvatar


@control_silo_endpoint
class DocIntegrationAvatarEndpoint(AvatarMixin[DocIntegrationAvatar], DocIntegrationBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    object_type = "doc_integration"
    model = DocIntegrationAvatar
    serializer_cls = DocIntegrationAvatarSerializer

    def get_avatar_filename(self, obj):
        return f"{obj.slug}.png"
