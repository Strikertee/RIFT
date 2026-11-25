from __future__ import annotations

import asyncio
import hashlib
import uuid

from sqlalchemy import select

from app.config import Settings, get_settings
from app.db import close_engine, get_sessionmaker, init_schema
from app.models import Merchant, MockBankAccount, User
from app.timeutil import utc_now

DEMO_PARTICIPANTS: tuple[tuple[str, str, str], ...] = (
    ("+2348000000001", "Bayo Commuter", "CUSTOMER"),
    ("+2348000000002", "Ada Student", "CUSTOMER"),
    ("+2348000000003", "Mama Bose Provisions", "MERCHANT"),
    ("+2348000000004", "Kuto Market Kiosk", "MERCHANT"),
)


def deterministic_values(phone_number: str) -> tuple[str, str, str]:
    digest = hashlib.sha256(f"rift-demo-{phone_number}".encode("utf-8")).digest()
    public_key_hex = digest.hex()
    merchant_code = f"MCH-{digest[:4].hex().upper()}"
    account_number = str(int.from_bytes(digest[4:8], "big") % 10**10).zfill(10)
    return public_key_hex, merchant_code, account_number


async def seed(settings: Settings | None = None) -> None:
    active = settings or get_settings()
    await init_schema()
    async with get_sessionmaker()() as db:
        async with db.begin():
            for phone_number, display_name, role in DEMO_PARTICIPANTS:
                public_key_hex, merchant_code, account_number = deterministic_values(phone_number)
                user = await db.scalar(select(User).where(User.phone_number == phone_number))
                if user is None:
                    user = User(
                        id=uuid.uuid4(),
                        phone_number=phone_number,
                        display_name=display_name,
                        public_key_hex=public_key_hex,
                        role=role,
                        created_at=utc_now(),
                        updated_at=utc_now(),
                    )
                    db.add(user)
                    await db.flush()

                account = await db.scalar(
                    select(MockBankAccount).where(MockBankAccount.user_id == user.id)
                )
                if account is None:
                    db.add(
                        MockBankAccount(
                            id=uuid.uuid4(),
                            user_id=user.id,
                            account_number=account_number,
                            available_balance_kobo=active.mock_starting_balance_kobo,
                            reserved_balance_kobo=0,
                            created_at=utc_now(),
                            updated_at=utc_now(),
                        )
                    )

                if role == "MERCHANT":
                    merchant = await db.get(Merchant, user.id)
                    if merchant is None:
                        db.add(
                            Merchant(
                                id=user.id,
                                merchant_code=merchant_code,
                                business_name=display_name,
                                terminal_pubkey_hex=public_key_hex,
                                settlement_account_num=account_number,
                                risk_tier="STANDARD",
                                created_at=utc_now(),
                            )
                        )
            await db.flush()


async def _run() -> None:
    await seed()
    await close_engine()


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()


__all__ = ["seed"]
