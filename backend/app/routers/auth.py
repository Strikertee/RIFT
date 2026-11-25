from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.crypto import format_user_id
from app.db import get_db
from app.errors import ApiError
from app.models import Merchant, MockBankAccount, User
from app.schemas import RegisterRequest, RegisterResponse
from app.services.ledger import (
    generate_account_number,
    generate_merchant_code,
    write_audit,
)
from app.timeutil import as_utc, format_timestamp, utc_now

router = APIRouter(prefix="/auth", tags=["auth"])


async def _unused_account_number(db: AsyncSession) -> str:
    for _ in range(10):
        candidate = generate_account_number()
        exists = await db.scalar(
            select(MockBankAccount.id).where(MockBankAccount.account_number == candidate)
        )
        if exists is None:
            return candidate
    raise ApiError(500, "ACCOUNT_GENERATION_FAILED", "Could not allocate a mock account number.")


async def _unused_merchant_code(db: AsyncSession) -> str:
    for _ in range(10):
        candidate = generate_merchant_code()
        exists = await db.scalar(select(Merchant.id).where(Merchant.merchant_code == candidate))
        if exists is None:
            return candidate
    raise ApiError(500, "MERCHANT_CODE_GENERATION_FAILED", "Could not allocate a merchant code.")


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> RegisterResponse:
    async with db.begin():
        public_key_match = await db.scalar(
            select(User.id).where(User.public_key_hex == payload.public_key_hex)
        )
        if public_key_match is not None:
            raise ApiError(409, "PUBLIC_KEY_ALREADY_REGISTERED", "Public key is already registered.")

        phone_match = await db.scalar(
            select(User.id).where(User.phone_number == payload.phone_number)
        )
        if phone_match is not None:
            raise ApiError(409, "PHONE_ALREADY_REGISTERED", "Phone number is already registered.")

        merchant_code: str | None = None
        if payload.user_type == "MERCHANT":
            merchant_code = payload.merchant_code or await _unused_merchant_code(db)
            code_match = await db.scalar(
                select(Merchant.id).where(Merchant.merchant_code == merchant_code)
            )
            if code_match is not None:
                raise ApiError(
                    409,
                    "MERCHANT_CODE_ALREADY_REGISTERED",
                    "Merchant code is already registered.",
                )

        now = utc_now()
        user = User(
            phone_number=payload.phone_number,
            display_name=payload.display_name,
            public_key_hex=payload.public_key_hex,
            role=payload.user_type,
            created_at=now,
            updated_at=now,
        )
        db.add(user)
        await db.flush()

        account = MockBankAccount(
            user_id=user.id,
            account_number=await _unused_account_number(db),
            available_balance_kobo=settings.mock_starting_balance_kobo,
            reserved_balance_kobo=0,
            created_at=now,
            updated_at=now,
        )
        db.add(account)

        if payload.user_type == "MERCHANT":
            db.add(
                Merchant(
                    id=user.id,
                    merchant_code=merchant_code or await _unused_merchant_code(db),
                    business_name=payload.business_name or payload.display_name,
                    terminal_pubkey_hex=payload.public_key_hex,
                    settlement_account_num=account.account_number,
                    risk_tier="STANDARD",
                    created_at=now,
                )
            )

        await write_audit(
            db,
            "USER_REGISTERED",
            format_user_id(user.id, user.role),
            "core",
            {"user_type": user.role, "phone_number": user.phone_number},
        )

    response.status_code = status.HTTP_201_CREATED
    return RegisterResponse(
        user_id=format_user_id(user.id, user.role),
        user_type=user.role,
        display_name=user.display_name,
        phone_number=user.phone_number,
        public_key_hex=user.public_key_hex,
        mock_account_number=account.account_number,
        mock_balance_kobo=account.available_balance_kobo,
        created_at=format_timestamp(as_utc(user.created_at)),
    )

