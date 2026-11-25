"""Idempotently seed the four demo participants described in DATA_MODEL.md.

Keys are deterministic from SHA256("rift-demo-<phone>") so a demo can be
reproduced across machines. Run with: python -m app.seed
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone

from nacl.signing import SigningKey
from sqlalchemy import select

from .config import settings
from .db import SessionLocal, create_schema
from .models import Merchant, MockBankAccount, User

DEMO_USERS = [
    ("+2348000000001", "Bayo Commuter", "CUSTOMER", None),
    ("+2348000000002", "Ada Student", "CUSTOMER", None),
    ("+2348000000003", "Mama Bose Provisions", "MERCHANT", "MCHBOSE01"),
    ("+2348000000004", "Kuto Market Kiosk", "MERCHANT", "MCHKUTO01"),
]


def keypair_for(phone: str) -> tuple[str, str]:
    seed = hashlib.sha256(f"rift-demo-{phone}".encode("utf-8")).digest()
    signing = SigningKey(seed)
    return bytes(signing.verify_key).hex(), bytes(signing).hex()


def main() -> None:
    create_schema()
    with SessionLocal() as db:
        for phone, name, role, code in DEMO_USERS:
            if db.scalar(select(User.id).where(User.phone_number == phone)):
                continue
            pubkey, _ = keypair_for(phone)
            now = datetime.now(timezone.utc)
            user = User(
                id=uuid.uuid4(),
                phone_number=phone,
                display_name=name,
                public_key_hex=pubkey,
                role=role,
                created_at=now,
                updated_at=now,
            )
            db.add(user)
            db.flush()
            account = MockBankAccount(
                id=uuid.uuid4(),
                user_id=user.id,
                account_number=f"01{user.id.int % 100_000_000:08d}",
                available_balance_kobo=settings.mock_starting_balance_kobo,
                reserved_balance_kobo=0,
                created_at=now,
                updated_at=now,
            )
            db.add(account)
            if role == "MERCHANT":
                db.add(
                    Merchant(
                        id=user.id,
                        merchant_code=code or f"MCH{str(user.id)[:6].upper()}",
                        business_name=name,
                        terminal_pubkey_hex=pubkey,
                        settlement_account_num=account.account_number,
                        risk_tier="STANDARD",
                        max_offline_ticket_kobo=500_000,
                        max_cumulative_offline_kobo=5_000_000,
                        created_at=now,
                    )
                )
        db.commit()
    print("Demo participants ready.")


if __name__ == "__main__":
    main()
