from __future__ import annotations

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.crypto import issuer_pubkey_hex
from app.db import database_is_connected
from app.schemas import HealthResponse
from app.timeutil import format_timestamp, utc_now

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    timestamp = format_timestamp(utc_now())
    database_status = "connected" if await database_is_connected() else "disconnected"
    public_key = issuer_pubkey_hex(settings)
    key_loaded = public_key is not None
    return HealthResponse(
        status="healthy" if database_status == "connected" and key_loaded else "degraded",
        environment=settings.environment,
        version=settings.app_version,
        timestamp=timestamp,
        database=database_status,
        issuer_key_loaded=key_loaded,
        issuer_pubkey_hex=public_key,
    )
