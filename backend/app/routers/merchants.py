from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crypto import format_user_id, parse_identifier_uuid
from app.db import get_db
from app.deps import get_current_user
from app.errors import ApiError
from app.models import Merchant, Transaction, User
from app.schemas import SettlementItem, SettlementResponse
from app.services.ingestion import CANONICAL_SETTLED
from app.timeutil import as_utc, format_timestamp

router = APIRouter(prefix="/merchants", tags=["merchants"])


@router.get("/{merchant_id}/settlements", response_model=SettlementResponse)
async def merchant_settlements(
    merchant_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SettlementResponse:
    if merchant_id.startswith("usr_"):
        raise ApiError(404, "UNKNOWN_MERCHANT", "Merchant was not found.")
    try:
        resolved_id = parse_identifier_uuid(merchant_id)
    except ValueError as exc:
        raise ApiError(404, "UNKNOWN_MERCHANT", "Merchant was not found.") from exc

    merchant = await db.get(Merchant, resolved_id)
    if merchant is None:
        raise ApiError(404, "UNKNOWN_MERCHANT", "Merchant was not found.")
    if current_user.role != "ADMIN" and current_user.id != merchant.id:
        raise ApiError(403, "FORBIDDEN", "Settlement ledger belongs to another merchant.")

    rows = (
        await db.execute(
            select(Transaction)
            .where(
                Transaction.merchant_id == merchant.id,
                Transaction.status == CANONICAL_SETTLED,
            )
            .order_by(Transaction.settled_at.desc())
        )
    ).scalars().all()
    total = await db.scalar(
        select(func.coalesce(func.sum(Transaction.amount_kobo), 0)).where(
            Transaction.merchant_id == merchant.id,
            Transaction.status == CANONICAL_SETTLED,
        )
    )

    items = [
        SettlementItem(
            transaction_id=row.transaction_id,
            oac_id=row.oac_id,
            seq_no=row.seq_no,
            amount_kobo=row.amount_kobo,
            currency=row.currency,
            status=row.status,
            simulated_clearing_ref=row.simulated_clearing_ref,
            settled_at=(
                format_timestamp(as_utc(row.settled_at)) if row.settled_at is not None else None
            ),
        )
        for row in rows
    ]
    return SettlementResponse(
        merchant_id=format_user_id(merchant.id, "MERCHANT"),
        total_settled_kobo=int(total or 0),
        count=len(items),
        settlements=items,
    )
