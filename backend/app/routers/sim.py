from __future__ import annotations

import hmac
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..errors import ApiError
from ..models import Allocation, AuditLog, MockBankAccount, Transaction

router = APIRouter(prefix="/sim", tags=["simulation"])


@router.post("/reset")
def reset(
    x_admin_secret: Annotated[str | None, Header()] = None,
    db: Session = Depends(get_db),
) -> dict:
    if not settings.admin_secret:
        raise ApiError(403, "ADMIN_DISABLED", "ADMIN_SECRET is not configured.")
    if not hmac.compare_digest(x_admin_secret or "", settings.admin_secret):
        raise ApiError(401, "UNAUTHORIZED", "A valid X-Admin-Secret header is required.")

    transactions_purged = db.scalar(select(func.count()).select_from(Transaction)) or 0
    allocations_reset = db.scalar(select(func.count()).select_from(Allocation)) or 0
    accounts = db.scalar(select(func.count()).select_from(MockBankAccount)) or 0

    db.execute(delete(Transaction))
    db.execute(delete(Allocation))
    db.execute(delete(AuditLog))
    db.execute(
        update(MockBankAccount).values(
            available_balance_kobo=settings.mock_starting_balance_kobo,
            reserved_balance_kobo=0,
            updated_at=datetime.now(timezone.utc),
        )
    )
    db.add(
        AuditLog(
            event_type="SIM_RESET",
            entity_id="simulation",
            actor="ADMIN",
            payload={"transactions_purged": transactions_purged, "allocations_reset": allocations_reset},
            created_at=datetime.now(timezone.utc),
        )
    )
    db.commit()

    return {
        "status": "ledger_reseeded",
        "mock_users_reset": accounts,
        "transactions_purged": transactions_purged,
        "allocations_reset": allocations_reset,
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    }
