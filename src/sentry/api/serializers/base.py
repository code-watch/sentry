from __future__ import annotations

import logging
from collections.abc import Callable, Mapping, MutableMapping, Sequence
from typing import Any, TypeVar

import sentry_sdk
from django.contrib.auth.models import AnonymousUser

from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser

logger = logging.getLogger(__name__)

K = TypeVar("K")

registry: MutableMapping[Any, Any] = {}


def register(type: Any) -> Callable[[type[K]], type[K]]:
    """A wrapper that adds the wrapped Serializer to the Serializer registry (see above) for the key `type`."""

    def wrapped(cls: type[K]) -> type[K]:
        registry[type] = cls()
        return cls

    return wrapped


def serialize(
    objects: Any | Sequence[Any],
    user: User | RpcUser | AnonymousUser | None = None,
    serializer: Any | None = None,
    **kwargs: Any,
) -> Any:
    """
    Turn a model (or list of models) into a python object made entirely of primitives.

    :param objects: A list of objects
    :param user: The user who will be viewing the objects. Omit to view as `AnonymousUser`.
    :param serializer: The `Serializer` class whose logic we'll use to serialize
        `objects` (see below.) Omit to just look up the Serializer in the
        registry by the `objects`'s type.
    :param kwargs Any
    :returns A list of the serialized versions of `objects`.
    """
    if user is None:
        user = AnonymousUser()

    if not objects:
        return objects
    # sets aren't predictable, so generally you should use a list, but it's
    # supported out of convenience
    elif not isinstance(objects, (list, tuple, set, frozenset)):
        return serialize([objects], user=user, serializer=serializer, **kwargs)[0]

    if serializer is None:
        # find the first object that is in the registry
        for o in objects:
            try:
                serializer = registry[type(o)]
                break
            except KeyError:
                pass
        else:
            return objects
    with sentry_sdk.start_span(op="serialize", name=type(serializer).__name__) as span:
        span.set_data("Object Count", len(objects))

        with sentry_sdk.start_span(op="serialize.get_attrs", name=type(serializer).__name__):
            attrs = serializer.get_attrs(
                # avoid passing NoneType's to the serializer as they're allowed and
                # filtered out of serialize()
                item_list=[o for o in objects if o is not None],
                user=user,
                **kwargs,
            )

        with sentry_sdk.start_span(op="serialize.iterate", name=type(serializer).__name__):
            return [serializer(o, attrs=attrs.get(o, {}), user=user, **kwargs) for o in objects]


class Serializer:
    """A Serializer class contains the logic to serialize a specific type of object."""

    def __call__(
        self,
        obj: Any,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> Mapping[str, Any] | None:
        """See documentation for `serialize`."""
        if obj is None:
            return None
        return self._serialize(obj, attrs, user, **kwargs)

    def get_attrs(
        self, item_list: Sequence[Any], user: User | RpcUser | AnonymousUser, **kwargs: Any
    ) -> MutableMapping[Any, Any]:
        """
        Fetch all of the associated data needed to serialize the objects in `item_list`.

        :param item_list: List of input objects that should be serialized.
        :param user: The user who will be viewing the objects.
        :param kwargs: Any
        :returns A mapping of items from the `item_list` to an Object.
        """
        return {}

    def _serialize(
        self,
        obj: Any,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> Mapping[str, Any] | None:
        try:
            return self.serialize(obj, attrs, user, **kwargs)
        except Exception:
            logger.exception("Failed to serialize", extra={"instance": obj})
            return None

    def serialize(
        self,
        obj: Any,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> Mapping[str, Any]:
        """
        Convert an arbitrary python object `obj` to an object that only contains primitives.

        :param obj: An item from `item_list` that was passed to `get_attrs`.
        :param attrs: The object in `get_attrs` that corresponds to `obj`.
        :param user: The user who will be viewing the objects.
        :param kwargs: Any
        :returns A serialized version of `obj`.
        """
        return {}
