from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..errors import ApiError
from ..ids import new_account_number, user_id_for
from ..models import AuditLog, Merchant, MockBankAccount, User
from ..schemas import RegisterRequest

router = APIRouter(prefix="/auth", tags=["auth"])


def _unique_account_number(db: Session) -> str:
    for _ in range(20):
        candidate = new_account_number()
        exists = db.scalar(
            select(MockBankAccount.id).where(MockBankAccount.account_number == candidate)
        )
        if exists is None:
            return candidate
    return f"01{secrets.randbelow(100_000_000):08d}"


def _unique_merchant_code(db: Session, requested: str | None) -> str:
    if requested:
        if db.scalar(select(Merchant.id).where(Merchant.merchant_code == requested)):
            raise ApiError(409, "MERCHANT_CODE_ALREADY_REGISTERED", "Merchant code already registered.")
        return requested
    for _ in range(20):
        candidate = f"MCH{secrets.randbelow(1_000_000):06d}"
        if db.scalar(select(Merchant.id).where(Merchant.merchant_code == candidate)) is None:
            return candidate
    return f"MCH{uuid.uuid4().hex[:8].upper()}"


@router.post("/register", status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> dict:
    if db.scalar(select(User.id).where(User.public_key_hex == payload.public_key_hex)):
        raise ApiError(409, "PUBLIC_KEY_ALREADY_REGISTERED", "This public key is already registered.")
    if db.scalar(select(User.id).where(User.phone_number == payload.phone_number)):
        raise ApiError(409, "PHONE_ALREADY_REGISTERED", "This phone number is already registered.")

    role = payload.user_type
    now = datetime.now(timezone.utc)
    user = User(
        id=uuid.uuid4(),
        phone_number=payload.phone_number,
        display_name=payload.display_name,
        public_key_hex=payload.public_key_hex,
        role=role,
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    db.flush()

    account = MockBankAccount(
        id=uuid.uuid4(),
        user_id=user.id,
        account_number=_unique_account_number(db),
        available_balance_kobo=settings.mock_starting_balance_kobo,
        reserved_balance_kobo=0,
        created_at=now,
        updated_at=now,
    )
    db.add(account)

    if role == "MERCHANT":
        business_name = payload.business_name or payload.display_name
        merchant_code = _unique_merchant_code(db, payload.merchant_code)
        db.add(
            Merchant(
                id=user.id,
                merchant_code=merchant_code,
                business_name=business_name,
                terminal_pubkey_hex=payload.public_key_hex,
                settlement_account_num=account.account_number,
                risk_tier="STANDARD",
                max_offline_ticket_kobo=500_000,
                max_cumulative_offline_kobo=5_000_000,
                created_at=now,
            )
        )

    db.add(
        AuditLog(
            event_type="USER_REGISTERED",
            entity_id=str(user.id),
            actor=role,
            payload={"display_name": payload.display_name, "role": role},
            created_at=now,
        )
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ApiError(409, "REGISTRATION_CONFLICT", "Registration conflicts with an existing record.")

    return {
        "user_id": user_id_for(role, user.id),
        "user_type": role,
        "display_name": user.display_name,
        "phone_number": user.phone_number,
        "public_key_hex": user.public_key_hex,
        "mock_account_number": account.account_number,
        "mock_balance_kobo": account.available_balance_kobo,
        "created_at": user.created_at.isoformat(timespec="seconds").replace("+00:00", "Z"),
    }
