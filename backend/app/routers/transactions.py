from __future__ import annotations

import hmac
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import CurrentUser
from ..errors import ApiError
from ..ids import merchant_id_for
from ..models import Allocation, Transaction
from ..schemas import RelayRequest
from ..security import iso_z
from ..services.ingestion import relay_batch

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("/relay")
def relay(
    payload: RelayRequest,
    x_relay_api_key: Annotated[str | None, Header()] = None,
) -> dict:
    if settings.relay_api_key:
        supplied = x_relay_api_key or ""
        if not hmac.compare_digest(supplied, settings.relay_api_key):
            raise ApiError(401, "UNAUTHORIZED_RELAY", "A valid relay API key is required.")

    results = relay_batch(payload.transactions)
    return {
        "batch_id": f"bat_{uuid.uuid4()}",
        "total_received": len(payload.transactions),
        "results": results,
    }


@router.get("/{transaction_id}/status")
def transaction_status(
    transaction_id: str,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> dict:
    transaction = db.scalar(
        select(Transaction).where(Transaction.transaction_id == transaction_id)
    )
    if transaction is None:
        raise ApiError(404, "TRANSACTION_NOT_FOUND", "Transaction was not found.")

    allocation = db.scalar(select(Allocation).where(Allocation.oac_id == transaction.oac_id))
    is_owner = allocation is not None and allocation.user_id == user.id
    is_merchant = transaction.merchant_id == user.id
    if not (is_owner or is_merchant or user.role == "ADMIN"):
        raise ApiError(403, "FORBIDDEN", "You cannot view this transaction.")

    return {
        "transaction_id": transaction.transaction_id,
        "oac_id": transaction.oac_id,
        "seq_no": transaction.seq_no,
        "amount_kobo": transaction.amount_kobo,
        "currency": transaction.currency,
        "merchant_id": merchant_id_for(transaction.merchant_id),
        "status": transaction.status,
        "simulated_clearing_ref": transaction.simulated_clearing_ref,
        "created_offline_at": iso_z(transaction.created_offline_at),
        "ingested_at": iso_z(transaction.ingested_at),
        "settled_at": iso_z(transaction.settled_at) if transaction.settled_at else None,
    }
