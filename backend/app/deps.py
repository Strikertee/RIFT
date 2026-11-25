from __future__ import annotations

import secrets
import uuid

from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.crypto import parse_identifier_uuid
from app.db import get_db
from app.errors import ApiError
from app.models import User

bearer_scheme = HTTPBearer(auto_error=False)
_fallback_admin_secret = secrets.token_hex(24)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise ApiError(401, "UNAUTHORIZED", "Bearer authentication is required.")
    try:
        user_id = parse_identifier_uuid(credentials.credentials)
    except ValueError as exc:
        raise ApiError(401, "UNAUTHORIZED", "Bearer token is not a valid account id.") from exc
    user = await db.get(User, user_id)
    if user is None:
        raise ApiError(401, "UNAUTHORIZED", "Unknown account id.")
    return user


def require_customer(user: User = Depends(get_current_user)) -> User:
    if user.role != "CUSTOMER":
        raise ApiError(403, "FORBIDDEN", "Customer role is required.")
    return user


def require_admin(
    x_admin_secret: str | None = Header(default=None, alias="X-Admin-Secret"),
    settings: Settings = Depends(get_settings),
) -> None:
    expected = settings.admin_secret or _fallback_admin_secret
    if x_admin_secret is None or not secrets.compare_digest(x_admin_secret, expected):
        raise ApiError(403, "FORBIDDEN", "Admin secret is invalid.")


def require_relay_key(
    x_relay_api_key: str | None = Header(default=None, alias="X-Relay-Api-Key"),
    settings: Settings = Depends(get_settings),
) -> None:
    expected = settings.relay_api_key
    if expected and (x_relay_api_key is None or not secrets.compare_digest(x_relay_api_key, expected)):
        raise ApiError(401, "UNAUTHORIZED_RELAY", "Relay API key is invalid.")


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await db.scalar(select(User).where(User.id == user_id))


def http_401() -> HTTPException:
    return HTTPException(status_code=401, detail="Unauthorized")
