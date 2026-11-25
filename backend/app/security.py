from __future__ import annotations

import json
from datetime import datetime, timezone

from nacl.exceptions import BadSignatureError
from nacl.signing import SigningKey, VerifyKey

from .config import settings

UTC = timezone.utc


class IssuerUnavailable(RuntimeError):
    pass


def canonical_json(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def iso_z(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_iso(value: str) -> datetime:
    if not isinstance(value, str) or not value:
        raise ValueError("timestamp must be a string")
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def oac_payload(oac: dict) -> dict:
    return {
        "allocated_amount_kobo": oac["allocated_amount_kobo"],
        "currency": oac["currency"],
        "customer_id": oac["customer_id"],
        "customer_pubkey_hex": oac["customer_pubkey_hex"],
        "expires_at": oac["expires_at"],
        "issued_at": oac["issued_at"],
        "issuer_key_version": oac["issuer_key_version"],
        "oac_id": oac["oac_id"],
    }


def tx_payload(tx: dict) -> dict:
    return {
        "amount_kobo": tx["amount_kobo"],
        "currency": tx["currency"],
        "customer_timestamp": tx["customer_timestamp"],
        "invoice_nonce": tx["invoice_nonce"],
        "merchant_id": tx["merchant_id"],
        "oac_id": tx["oac_id"],
        "seq_no": tx["seq_no"],
    }


def _signing_key() -> SigningKey:
    if not settings.issuer_key_loaded:
        raise IssuerUnavailable("Issuer key is not configured.")
    return SigningKey(bytes.fromhex(settings.issuer_private_key_hex))


def issuer_public_hex() -> str:
    if not settings.issuer_key_loaded:
        return ""
    return bytes(_signing_key().verify_key).hex()


def sign_oac(unsigned: dict) -> str:
    signature = _signing_key().sign(canonical_json(oac_payload(unsigned)).encode("utf-8"))
    return signature.signature.hex()


def verify_ed25519(payload: dict, signature_hex: str, public_key_hex: str) -> bool:
    try:
        message = canonical_json(payload).encode("utf-8")
        VerifyKey(bytes.fromhex(public_key_hex)).verify(message, bytes.fromhex(signature_hex))
        return True
    except (BadSignatureError, ValueError, TypeError):
        return False
