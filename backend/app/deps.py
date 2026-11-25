from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from .db import get_db
from .errors import ApiError
from .ids import parse_uuid
from .models import User


def current_user(
    authorization: Annotated[str | None, Header()] = None,
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise ApiError(401, "UNAUTHORIZED", "A valid bearer token is required.")
    raw = authorization.split(" ", 1)[1].strip()
    user_uuid = parse_uuid(raw)
    if user_uuid is None:
        raise ApiError(401, "UNAUTHORIZED", "A valid bearer token is required.")
    user = db.get(User, user_uuid)
    if user is None:
        raise ApiError(401, "UNAUTHORIZED", "A valid bearer token is required.")
    return user


CurrentUser = Annotated[User, Depends(current_user)]
DbSession = Annotated[Session, Depends(get_db)]
