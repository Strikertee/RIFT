from __future__ import annotations

import hashlib
import json
import uuid
from collections.abc import Mapping

from nacl.exceptions import BadSignatureError
from nacl.signing import SigningKey, VerifyKey

from app.config import Settings

_DEV_ISSUER_SEED = hashlib.sha256(b"rift-dev-issuer-key-v1").digest()


class CryptoConfigurationError(RuntimeError):
    """Raised when a signing key is missing or malformed."""


def _decode_seed(seed_hex: str, label: str) -> bytes:
    try:
        seed = bytes.fromhex(seed_hex)
    except ValueError as exc:
        raise CryptoConfigurationError(f"{label} must be 64 hex characters.") from exc
    if len(seed) != 32:
        raise CryptoConfigurationError(f"{label} must decode to 32 bytes.")
    return seed


def load_issuer_signing_key(settings: Settings) -> SigningKey:
    if settings.rift_issuer_private_key_hex:
        return SigningKey(_decode_seed(settings.rift_issuer_private_key_hex, "RIFT_ISSUER_PRIVATE_KEY_HEX"))
    if settings.environment.lower() == "production":
        raise CryptoConfigurationError("RIFT_ISSUER_PRIVATE_KEY_HEX is required in production.")
    return SigningKey(_DEV_ISSUER_SEED)


def load_issuer_verifying_key(settings: Settings) -> VerifyKey:
    return load_issuer_signing_key(settings).verify_key


def issuer_pubkey_hex(settings: Settings) -> str | None:
    try:
        return load_issuer_verifying_key(settings).encode().hex()
    except CryptoConfigurationError:
        return None


def canonical_json(payload: Mapping[str, object]) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def canonical_bytes(payload: Mapping[str, object]) -> bytes:
    return canonical_json(payload).encode("utf-8")


def sign_payload(signing_key: SigningKey, payload: Mapping[str, object]) -> str:
    return signing_key.sign(canonical_bytes(payload)).signature.hex()


def verify_payload_signature(
    verifying_key: VerifyKey,
    payload: Mapping[str, object],
    signature_hex: str,
) -> bool:
    try:
        signature = bytes.fromhex(signature_hex)
        verifying_key.verify(canonical_bytes(payload), signature)
    except (ValueError, BadSignatureError):
        return False
    return True


def derive_transaction_id(oac_id: str, seq_no: int, invoice_nonce: str) -> str:
    digest = hashlib.sha256(f"{oac_id}{seq_no}{invoice_nonce}".encode("utf-8")).hexdigest()[:32]
    return f"tx_{digest[:8]}-{digest[8:12]}-{digest[12:16]}-{digest[16:20]}-{digest[20:]}"


def oac_payload(
    *,
    oac_id: str,
    customer_id: str,
    customer_pubkey_hex: str,
    allocated_amount_kobo: int,
    currency: str,
    issued_at: str,
    expires_at: str,
    issuer_key_version: str,
) -> dict[str, object]:
    return {
        "oac_id": oac_id,
        "customer_id": customer_id,
        "customer_pubkey_hex": customer_pubkey_hex,
        "allocated_amount_kobo": allocated_amount_kobo,
        "currency": currency,
        "issued_at": issued_at,
        "expires_at": expires_at,
        "issuer_key_version": issuer_key_version,
    }


def oac_payload_from_mapping(payload: Mapping[str, object]) -> dict[str, object]:
    return {
        "oac_id": payload["oac_id"],
        "customer_id": payload["customer_id"],
        "customer_pubkey_hex": payload["customer_pubkey_hex"],
        "allocated_amount_kobo": payload["allocated_amount_kobo"],
        "currency": payload["currency"],
        "issued_at": payload["issued_at"],
        "expires_at": payload["expires_at"],
        "issuer_key_version": payload["issuer_key_version"],
    }


def transaction_payload(
    *,
    oac_id: str,
    seq_no: int,
    invoice_nonce: str,
    merchant_id: str,
    amount_kobo: int,
    currency: str,
    customer_timestamp: int,
) -> dict[str, object]:
    return {
        "oac_id": oac_id,
        "seq_no": seq_no,
        "invoice_nonce": invoice_nonce,
        "merchant_id": merchant_id,
        "amount_kobo": amount_kobo,
        "currency": currency,
        "customer_timestamp": customer_timestamp,
    }


def parse_identifier_uuid(value: str) -> uuid.UUID:
    candidate = value.strip()
    if candidate.startswith(("usr_", "mch_")):
        candidate = candidate[4:]
    return uuid.UUID(candidate)


def format_user_id(user_id: uuid.UUID, role: str) -> str:
    prefix = "mch_" if role == "MERCHANT" else "usr_"
    return f"{prefix}{user_id}"
