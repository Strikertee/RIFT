from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.config import Settings, get_settings
from app.models import Base

_engine: AsyncEngine | None = None


def get_engine(settings: Settings | None = None) -> AsyncEngine:
    global _engine
    if _engine is None:
        active = settings or get_settings()
        options: dict[str, object] = {"echo": False, "pool_pre_ping": True}
        if active.database_url.startswith("sqlite"):
            options["connect_args"] = {"check_same_thread": False}
        _engine = create_async_engine(active.database_url, **options)
    return _engine


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False, autoflush=False)


def reset_engine() -> None:
    global _engine
    _engine = None


async def init_schema() -> None:
    if not get_settings().auto_create_schema:
        return
    async with get_engine().begin() as connection:
        await connection.run_sync(Base.metadata.create_all)


async def close_engine() -> None:
    global _engine
    if _engine is not None:
        await _engine.dispose()
        _engine = None


async def database_is_connected() -> bool:
    try:
        async with get_sessionmaker() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


async def get_db() -> AsyncIterator[AsyncSession]:
    async with get_sessionmaker() as session:
        yield session
