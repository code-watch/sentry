from rest_framework.response import Response

from sentry import eventstore
from sentry.api.serializers import serialize
from sentry.search.events.filter import get_filter
from sentry.utils.validators import normalize_event_id


def get_direct_hit_response(request, query, snuba_params, referrer):
    """
    Checks whether a query is a direct hit for an event, and if so returns
    a response. Otherwise returns None
    """
    event_id = normalize_event_id(query)
    if event_id:
        snuba_filter = get_filter(query=f"id:{event_id}", params=snuba_params)
        snuba_filter.conditions.append(["event.type", "!=", "transaction"])

        results = eventstore.get_events(referrer=referrer, filter=snuba_filter)

        if len(results) == 1:
            response = Response(serialize(results, request.user))
            response["X-Sentry-Direct-Hit"] = "1"
            return response
