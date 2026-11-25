from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import CurrentUser
from ..errors import ApiError
from ..ids import merchant_id_for, parse_uuid
from ..models import Merchant, Transaction
from ..security import iso_z

router = APIRouter(prefix="/merchants", tags=["merchants"])


@router.get("/{merchant_id}/settlements")
def settlements(merchant_id: str, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    merchant_uuid = parse_uuid(merchant_id)
    if merchant_uuid is None:
        raise ApiError(404, "MERCHANT_NOT_FOUND", "Merchant was not found.")
    merchant = db.get(Merchant, merchant_uuid)
    if merchant is None:
        raise ApiError(404, "MERCHANT_NOT_FOUND", "Merchant was not found.")
    if user.id != merchant.id and user.role != "ADMIN":
        raise ApiError(403, "FORBIDDEN", "You cannot view this merchant's settlements.")

    rows = list(
        db.scalars(
            select(Transaction)
            .where(
                Transaction.merchant_id == merchant_uuid,
                Transaction.status == "SETTLED (SIMULATED)",
            )
            .order_by(Transaction.settled_at.desc())
        )
    )

    items = [
        {
            "transaction_id": row.transaction_id,
            "oac_id": row.oac_id,
            "seq_no": row.seq_no,
            "amount_kobo": row.amount_kobo,
            "currency": row.currency,
            "status": row.status,
            "simulated_clearing_ref": row.simulated_clearing_ref,
            "settled_at": iso_z(row.settled_at) if row.settled_at else None,
        }
        for row in rows
    ]

    return {
        "merchant_id": merchant_id_for(merchant.id),
        "total_settled_kobo": sum(item["amount_kobo"] for item in items),
        "count": len(items),
        "settlements": items,
    }
