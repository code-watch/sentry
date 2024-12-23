from __future__ import annotations

from sentry.api.helpers.android_models import ANDROID_MODELS
from sentry.api.helpers.ios_models import IOS_MODELS


def get_readable_device_name(device: str) -> str | None:
    if device in IOS_MODELS:
        return IOS_MODELS[device]
    if device in ANDROID_MODELS:
        return ANDROID_MODELS[device]
    return None
