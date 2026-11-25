from __future__ import annotations

import secrets

from nacl.signing import SigningKey

from app.crypto import derive_transaction_id, sign_payload, transaction_payload

CUSTOMER_SEED_HEX = "2222222222222222222222222222222222222222222222222222222222222222"
MERCHANT_SEED_HEX = "3333333333333333333333333333333333333333333333333333333333333333"
STRANGER_SEED_HEX = "4444444444444444444444444444444444444444444444444444444444444444"


def public_key_hex(seed_hex: str) -> str:
    return SigningKey(bytes.fromhex(seed_hex)).verify_key.encode().hex()


def register_body(
    *,
    user_type: str,
    display_name: str,
    phone_number: str,
    seed_hex: str,
    business_name: str | None = None,
) -> dict[str, object]:
    body: dict[str, object] = {
        "user_type": user_type,
        "display_name": display_name,
        "phone_number": phone_number,
        "public_key_hex": public_key_hex(seed_hex),
    }
    if business_name is not None:
        body["business_name"] = business_name
    return body


def make_transaction(
    *,
    oac: dict[str, object],
    merchant_id: str,
    customer_seed_hex: str = CUSTOMER_SEED_HEX,
    amount_kobo: int,
    seq_no: int,
    invoice_nonce: str | None = None,
    customer_timestamp: int = 1_760_000_000,
) -> dict[str, object]:
    nonce = invoice_nonce or secrets.token_hex(16)
    oac_id = str(oac["oac_id"])
    canonical = transaction_payload(
        oac_id=oac_id,
        seq_no=seq_no,
        invoice_nonce=nonce,
        merchant_id=merchant_id,
        amount_kobo=amount_kobo,
        currency="NGN",
        customer_timestamp=customer_timestamp,
    )
    signature_hex = sign_payload(SigningKey(bytes.fromhex(customer_seed_hex)), canonical)
    return {
        "transaction_id": derive_transaction_id(oac_id, seq_no, nonce),
        "oac_id": oac_id,
        "seq_no": seq_no,
        "merchant_id": merchant_id,
        "amount_kobo": amount_kobo,
        "currency": "NGN",
        "invoice_nonce": nonce,
        "customer_timestamp": customer_timestamp,
        "customer_pubkey_hex": public_key_hex(customer_seed_hex),
        "customer_signature_hex": signature_hex,
        "oac_token": dict(oac),
    }


def relay_body(*transactions: dict[str, object], relay_node_id: str | None = None) -> dict[str, object]:
    body: dict[str, object] = {"transactions": list(transactions)}
    if relay_node_id is not None:
        body["relay_node_id"] = relay_node_id
    return body
