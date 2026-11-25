from __future__ import annotations

import hashlib
import uuid


def parse_uuid(value: str) -> uuid.UUID | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    for prefix in ("usr_", "mch_", "gw_"):
        if text.startswith(prefix):
            text = text[len(prefix) :]
            break
    try:
        return uuid.UUID(text)
    except (ValueError, AttributeError):
        return None


def user_id_for(role: str, value: uuid.UUID) -> str:
    prefix = "mch_" if role == "MERCHANT" else "usr_"
    return f"{prefix}{value}"


def merchant_id_for(value: uuid.UUID) -> str:
    return f"mch_{value}"


def derive_transaction_id(oac_id: str, seq_no: int, invoice_nonce: str) -> str:
    digest = hashlib.sha256(f"{oac_id}{seq_no}{invoice_nonce}".encode("utf-8")).hexdigest()[:32]
    dashed = f"{digest[0:8]}-{digest[8:12]}-{digest[12:16]}-{digest[16:20]}-{digest[20:32]}"
    return f"tx_{dashed}"


def new_account_number() -> str:
    return f"01{uuid.uuid4().int % 100_000_000:08d}"
