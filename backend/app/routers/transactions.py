from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crypto import format_user_id
from app.db import get_db
from app.deps import get_current_user, require_relay_key
from app.errors import ApiError
from app.models import Allocation, Merchant, Transaction, User
from app.schemas import RelayBatchRequest, RelayResponse, TransactionStatusResponse
from app.services.ingestion import CANONICAL_SETTLED, ingest_transactions
from app.timeutil import as_utc, format_timestamp

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("/relay", response_model=RelayResponse)
async def relay_transactions(
    payload: RelayBatchRequest,
    _: None = Depends(require_relay_key),
) -> RelayResponse:
    batch_id, results = await ingest_transactions(payload)
    return RelayResponse(
        batch_id=batch_id,
        total_received=len(payload.transactions),
        results=results,
    )


@router.get("/{transaction_id}/status", response_model=TransactionStatusResponse)
async def transaction_status(
    transaction_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionStatusResponse:
    transaction = await db.scalar(
        select(Transaction).where(Transaction.transaction_id == transaction_id)
    )
    if transaction is None:
        raise ApiError(404, "TRANSACTION_NOT_FOUND", "Transaction was not found.")

    allocation = await db.scalar(
        select(Allocation).where(Allocation.oac_id == transaction.oac_id)
    )
    if allocation is None:
        raise ApiError(404, "TRANSACTION_NOT_FOUND", "Transaction allocation was not found.")
    merchant = await db.get(Merchant, transaction.merchant_id)
    if merchant is None:
        raise ApiError(404, "TRANSACTION_NOT_FOUND", "Transaction merchant was not found.")

    allowed = (
        current_user.role == "ADMIN"
        or allocation.user_id == current_user.id
        or merchant.id == current_user.id
    )
    if not allowed:
        raise ApiError(403, "FORBIDDEN", "Transaction belongs to another participant.")

    return TransactionStatusResponse(
        transaction_id=transaction.transaction_id,
        oac_id=transaction.oac_id,
        seq_no=transaction.seq_no,
        amount_kobo=transaction.amount_kobo,
        currency=transaction.currency,
        merchant_id=format_user_id(merchant.id, "MERCHANT"),
        status=transaction.status,
        simulated_clearing_ref=transaction.simulated_clearing_ref,
        created_offline_at=format_timestamp(as_utc(transaction.created_offline_at)),
        ingested_at=format_timestamp(as_utc(transaction.ingested_at)),
        settled_at=(
            format_timestamp(as_utc(transaction.settled_at))
            if transaction.settled_at is not None
            else None
        ),
    )


__all__ = ["router", "CANONICAL_SETTLED"]
