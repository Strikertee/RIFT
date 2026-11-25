from __future__ import annotations

import os
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_db, get_engine, get_sessionmaker, reset_engine
from app.main import app
from app.models import Base

TEST_ISSUER_SEED_HEX = "1111111111111111111111111111111111111111111111111111111111111111"

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("RIFT_ISSUER_PRIVATE_KEY_HEX", TEST_ISSUER_SEED_HEX)
os.environ.setdefault("ADMIN_SECRET", "test-admin-secret")
os.environ.setdefault("AUTO_CREATE_SCHEMA", "true")

_MUTABLE_FIELDS = (
    "environment",
    "database_url",
    "rift_issuer_private_key_hex",
    "issuer_key_version",
    "admin_secret",
    "relay_api_key",
    "mock_starting_balance_kobo",
    "auto_create_schema",
)


async def _override_get_db() -> AsyncIterator[AsyncSession]:
    async with get_sessionmaker()() as session:
        yield session


@pytest.fixture
async def client(tmp_path: object) -> AsyncIterator[AsyncClient]:
    settings = get_settings()
    original = {field: getattr(settings, field) for field in _MUTABLE_FIELDS}
    database_path = tmp_path / "rift_test.db"  # type: ignore[operator]

    settings.environment = "test"
    settings.database_url = f"sqlite+aiosqlite:///{database_path}"
    settings.rift_issuer_private_key_hex = TEST_ISSUER_SEED_HEX
    settings.issuer_key_version = "v1"
    settings.admin_secret = "test-admin-secret"
    settings.relay_api_key = None
    settings.mock_starting_balance_kobo = 5_000_000
    settings.auto_create_schema = True

    reset_engine()
    engine = get_engine()
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    app.dependency_overrides[get_db] = _override_get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()
        reset_engine()
        for field, value in original.items():
            setattr(settings, field, value)


@pytest.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    async with get_sessionmaker()() as session:
        yield session
