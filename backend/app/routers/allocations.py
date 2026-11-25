from __future__ import annotations

import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.crypto import (
    CryptoConfigurationError,
    format_user_id,
    load_issuer_signing_key,
    oac_payload,
    parse_identifier_uuid,
    sign_payload,
)
from app.db import get_db
from app.deps import get_current_user, require_customer
from app.errors import ApiError
from app.models import Allocation, MockBankAccount, User
from app.schemas import (
    AllocationIssueRequest,
    AllocationIssueResponse,
    AllocationStatusResponse,
)
from app.services.ledger import write_audit
from app.timeutil import as_utc, format_timestamp, utc_now

router = APIRouter(prefix="/allocations", tags=["allocations"])


@router.post("/issue", response_model=AllocationIssueResponse, status_code=status.HTTP_201_CREATED)
async def issue_allocation(
    payload: AllocationIssueRequest,
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AllocationIssueResponse:
    requested_customer_id: uuid.UUID | None = None
    if payload.customer_id is not None:
        try:
            requested_customer_id = parse_identifier_uuid(payload.customer_id)
        except ValueError as exc:
            raise ApiError(400, "INVALID_CUSTOMER_ID", "customer_id is not a valid account id.") from exc
        if requested_customer_id != current_user.id:
            raise ApiError(403, "CUSTOMER_MISMATCH", "customer_id must match the bearer token.")

    try:
        signing_key = load_issuer_signing_key(settings)
    except CryptoConfigurationError as exc:
        raise ApiError(500, "ISSUER_KEY_UNAVAILABLE", "Issuer key is not available.") from exc

    account = await db.scalar(
        select(MockBankAccount)
        .where(MockBankAccount.user_id == current_user.id)
        .with_for_update()
    )
    if account is None:
        raise ApiError(409, "MOCK_ACCOUNT_MISSING", "Mock bank account is missing.")
    if account.available_balance_kobo < payload.amount_kobo:
        raise ApiError(400, "INSUFFICIENT_FUNDS", "Available balance is insufficient.")

    now = utc_now()
    expires_at = now + timedelta(hours=payload.duration_hours)
    oac_id = f"oac_{uuid.uuid4().hex}"
    customer_id = format_user_id(current_user.id, current_user.role)
    issued_at_text = format_timestamp(now)
    expires_at_text = format_timestamp(expires_at)

    canonical = oac_payload(
        oac_id=oac_id,
        customer_id=customer_id,
        customer_pubkey_hex=current_user.public_key_hex,
        allocated_amount_kobo=payload.amount_kobo,
        currency="NGN",
        issued_at=issued_at_text,
        expires_at=expires_at_text,
        issuer_key_version=settings.issuer_key_version,
    )
    signature_hex = sign_payload(signing_key, canonical)

    db.add(
        Allocation(
            oac_id=oac_id,
            user_id=current_user.id,
            allocated_amount_kobo=payload.amount_kobo,
            spent_amount_kobo=0,
            currency="NGN",
            status="ACTIVE",
            issuer_key_version=settings.issuer_key_version,
            issuer_signature_hex=signature_hex,
            issued_at=now,
            expires_at=expires_at,
            created_at=now,
        )
    )
    account.available_balance_kobo -= payload.amount_kobo
    account.reserved_balance_kobo += payload.amount_kobo
    await write_audit(
        db,
        "OAC_ISSUED",
        oac_id,
        customer_id,
        {"allocated_amount_kobo": payload.amount_kobo, "duration_hours": payload.duration_hours},
    )
    await db.commit()

    return AllocationIssueResponse(
        oac_id=oac_id,
        customer_id=customer_id,
        customer_pubkey_hex=current_user.public_key_hex,
        allocated_amount_kobo=payload.amount_kobo,
        currency="NGN",
        issued_at=issued_at_text,
        expires_at=expires_at_text,
        issuer_key_version=settings.issuer_key_version,
        issuer_signature_hex=signature_hex,
        available_balance_kobo=account.available_balance_kobo,
        reserved_balance_kobo=account.reserved_balance_kobo,
    )


@router.get("/{oac_id}", response_model=AllocationStatusResponse)
async def allocation_status(
    oac_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AllocationStatusResponse:
    return await _allocation_status_impl(oac_id, current_user, db)


async def _allocation_status_impl(
    oac_id: str,
    current_user: User,
    db: AsyncSession,
) -> AllocationStatusResponse:
    allocation = await db.scalar(select(Allocation).where(Allocation.oac_id == oac_id))
    if allocation is None:
        raise ApiError(404, "OAC_NOT_FOUND", "Allocation was not found.")
    if allocation.user_id != current_user.id:
        raise ApiError(403, "FORBIDDEN", "Allocation belongs to another customer.")
    if allocation.status == "ACTIVE" and as_utc(allocation.expires_at) <= utc_now():
        allocation.status = "EXPIRED"
    account = await db.scalar(
        select(MockBankAccount).where(MockBankAccount.user_id == current_user.id)
    )
    if account is None:
        raise ApiError(409, "MOCK_ACCOUNT_MISSING", "Mock bank account is missing.")
    await db.commit()

    return AllocationStatusResponse(
        oac_id=allocation.oac_id,
        customer_id=format_user_id(current_user.id, current_user.role),
        allocated_amount_kobo=allocation.allocated_amount_kobo,
        spent_amount_kobo=allocation.spent_amount_kobo,
        remaining_amount_kobo=allocation.allocated_amount_kobo - allocation.spent_amount_kobo,
        currency=allocation.currency,
        status=allocation.status,
        issued_at=format_timestamp(as_utc(allocation.issued_at)),
        expires_at=format_timestamp(as_utc(allocation.expires_at)),
        issuer_key_version=allocation.issuer_key_version,
        available_balance_kobo=account.available_balance_kobo,
        reserved_balance_kobo=account.reserved_balance_kobo,
    )
