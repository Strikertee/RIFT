from __future__ import annotations

import re
from datetime import datetime, timezone

_TIMESTAMP_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
_TIMESTAMP_FORMAT = "%Y-%m-%dT%H:%M:%SZ"


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def format_timestamp(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).replace(microsecond=0).strftime(_TIMESTAMP_FORMAT)


def as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).replace(microsecond=0)


def parse_no_ms_timestamp(value: str) -> datetime | None:
    if not isinstance(value, str) or _TIMESTAMP_PATTERN.match(value) is None:
        return None
    try:
        return datetime.strptime(value, _TIMESTAMP_FORMAT).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def parse_customer_timestamp(value: int | str) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.lstrip("-").isdigit():
            return int(stripped)
        parsed = parse_no_ms_timestamp(stripped)
        if parsed is not None:
            return int(parsed.timestamp())
        try:
            fallback = datetime.fromisoformat(stripped.replace("Z", "+00:00"))
        except ValueError:
            return None
        if fallback.tzinfo is None:
            fallback = fallback.replace(tzinfo=timezone.utc)
        return int(fallback.timestamp())
    return None
