from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import text

from ..config import settings
from ..db import SessionLocal
from ..security import issuer_public_hex

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    database = "connected"
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception:
        database = "unavailable"

    key_loaded = settings.issuer_key_loaded
    return {
        "status": "healthy" if database == "connected" and key_loaded else "degraded",
        "environment": settings.environment,
        "version": settings.app_version,
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "database": database,
        "issuer_key_loaded": key_loaded,
        "issuer_pubkey_hex": issuer_public_hex(),
    }
