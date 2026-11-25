from __future__ import annotations

import secrets
import string

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog


def generate_account_number() -> str:
    return "".join(secrets.choice(string.digits) for _ in range(10))


def generate_merchant_code() -> str:
    return f"MCH-{secrets.token_hex(4).upper()}"


def generate_clearing_reference() -> str:
    return f"SIM_SETTLE_{secrets.token_hex(6).upper()}"


async def write_audit(
    db: AsyncSession,
    event_type: str,
    entity_id: str,
    actor: str,
    payload: dict[str, object],
) -> AuditLog:
    entry = AuditLog(
        event_type=event_type,
        entity_id=entity_id[:64],
        actor=actor[:50],
        payload=payload,
    )
    db.add(entry)
    await db.flush()
    return entry
