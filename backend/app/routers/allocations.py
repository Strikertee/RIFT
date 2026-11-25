from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import CurrentUser
from ..errors import ApiError
from ..ids import parse_uuid
from ..models import Allocation, AuditLog, MockBankAccount
from ..schemas import AllocationIssueRequest
from ..security import IssuerUnavailable, iso_z, sign_oac

router = APIRouter(prefix="/allocations", tags=["allocations"])


@router.post("/issue", status_code=201)
def issue_allocation(
    payload: AllocationIssueRequest,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> dict:
    if user.role != "CUSTOMER":
        raise ApiError(403, "FORBIDDEN", "Only customers can issue offline allocations.")

    if payload.customer_id:
        requested = parse_uuid(payload.customer_id)
        if requested is None:
            raise ApiError(400, "INVALID_CUSTOMER_ID", "customer_id is not a valid identifier.")
        if requested != user.id:
            raise ApiError(403, "CUSTOMER_MISMATCH", "customer_id must match the authenticated customer.")

    account = db.scalar(select(MockBankAccount).where(MockBankAccount.user_id == user.id))
    if account is None:
        raise ApiError(409, "MOCK_ACCOUNT_MISSING", "Mock bank account is missing for this customer.")

    if payload.amount_kobo > account.available_balance_kobo:
        raise ApiError(400, "INSUFFICIENT_FUNDS", "Available mock balance is insufficient.")

    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=payload.duration_hours)
    oac_id = f"oac_{uuid.uuid4().hex}"
    unsigned = {
        "oac_id": oac_id,
        "customer_id": f"usr_{user.id}",
        "customer_pubkey_hex": user.public_key_hex,
        "allocated_amount_kobo": payload.amount_kobo,
        "currency": "NGN",
        "issued_at": iso_z(now),
        "expires_at": iso_z(expires),
        "issuer_key_version": settings.issuer_key_version,
    }

    try:
        signature = sign_oac(unsigned)
    except IssuerUnavailable:
        raise ApiError(503, "ISSUER_KEY_UNAVAILABLE", "Issuer signing key is not configured.")

    allocation = Allocation(
        id=uuid.uuid4(),
        oac_id=oac_id,
        user_id=user.id,
        allocated_amount_kobo=payload.amount_kobo,
        spent_amount_kobo=0,
        currency="NGN",
        status="ACTIVE",
        issuer_key_version=settings.issuer_key_version,
        issuer_signature_hex=signature,
        issued_at=now,
        expires_at=expires,
        created_at=now,
    )
    account.available_balance_kobo -= payload.amount_kobo
    account.reserved_balance_kobo += payload.amount_kobo
    account.updated_at = now
    db.add(allocation)
    db.add(
        AuditLog(
            event_type="OAC_ISSUED",
            entity_id=oac_id,
            actor=f"usr_{user.id}",
            payload={"amount_kobo": payload.amount_kobo, "expires_at": iso_z(expires)},
            created_at=now,
        )
    )
    db.commit()

    return {
        **unsigned,
        "issuer_signature_hex": signature,
        "available_balance_kobo": account.available_balance_kobo,
        "reserved_balance_kobo": account.reserved_balance_kobo,
    }


@router.get("/{oac_id}")
def allocation_status(oac_id: str, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    allocation = db.scalar(select(Allocation).where(Allocation.oac_id == oac_id))
    if allocation is None:
        raise ApiError(404, "OAC_NOT_FOUND", "Offline allocation was not found.")
    if allocation.user_id != user.id:
        raise ApiError(403, "FORBIDDEN", "This allocation belongs to another customer.")

    now = datetime.now(timezone.utc)
    expires = allocation.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if allocation.status == "ACTIVE" and expires <= now:
        allocation.status = "EXPIRED"
        db.commit()

    account = db.scalar(select(MockBankAccount).where(MockBankAccount.user_id == user.id))
    if account is None:
        raise ApiError(409, "MOCK_ACCOUNT_MISSING", "Mock bank account is missing for this customer.")

    remaining = max(0, allocation.allocated_amount_kobo - allocation.spent_amount_kobo)
    return {
        "oac_id": allocation.oac_id,
        "customer_id": f"usr_{allocation.user_id}",
        "allocated_amount_kobo": allocation.allocated_amount_kobo,
        "spent_amount_kobo": allocation.spent_amount_kobo,
        "remaining_amount_kobo": remaining,
        "currency": allocation.currency,
        "status": allocation.status,
        "issued_at": iso_z(allocation.issued_at),
        "expires_at": iso_z(allocation.expires_at),
        "issuer_key_version": allocation.issuer_key_version,
        "available_balance_kobo": account.available_balance_kobo,
        "reserved_balance_kobo": account.reserved_balance_kobo,
    }
