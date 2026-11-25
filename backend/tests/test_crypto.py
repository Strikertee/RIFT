from __future__ import annotations

from datetime import datetime, timezone

from nacl.signing import SigningKey

from app.crypto import (
    canonical_json,
    derive_transaction_id,
    oac_payload,
    transaction_payload,
)
from app.timeutil import format_timestamp, parse_no_ms_timestamp


def test_rfc8032_ed25519_vector() -> None:
    seed = bytes.fromhex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60")
    signing_key = SigningKey(seed)
    assert signing_key.verify_key.encode().hex() == (
        "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a"
    )
    assert signing_key.sign(b"").signature.hex() == (
        "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901"
        "555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b"
    )


def test_canonical_json_sorts_keys_without_whitespace() -> None:
    assert canonical_json({"b": 1, "a": 2}) == '{"a":2,"b":1}'


def test_oac_payload_has_exact_canonical_fields() -> None:
    payload = oac_payload(
        oac_id="oac_1",
        customer_id="usr_1",
        customer_pubkey_hex="ab" * 32,
        allocated_amount_kobo=1000,
        currency="NGN",
        issued_at="2026-01-01T00:00:00Z",
        expires_at="2026-01-01T06:00:00Z",
        issuer_key_version="v1",
    )
    assert set(payload) == {
        "oac_id",
        "customer_id",
        "customer_pubkey_hex",
        "allocated_amount_kobo",
        "currency",
        "issued_at",
        "expires_at",
        "issuer_key_version",
    }


def test_transaction_payload_has_exact_canonical_fields() -> None:
    payload = transaction_payload(
        oac_id="oac_1",
        seq_no=1,
        invoice_nonce="nonce",
        merchant_id="mch_1",
        amount_kobo=500,
        currency="NGN",
        customer_timestamp=1_760_000_000,
    )
    assert set(payload) == {
        "oac_id",
        "seq_no",
        "invoice_nonce",
        "merchant_id",
        "amount_kobo",
        "currency",
        "customer_timestamp",
    }


def test_transaction_id_is_deterministic_and_dashed() -> None:
    first = derive_transaction_id("oac_1", 1, "nonce")
    second = derive_transaction_id("oac_1", 1, "nonce")
    assert first == second
    assert first.startswith("tx_")
    body = first[3:]
    assert len(body) == 36
    assert [len(part) for part in body.split("-")] == [8, 4, 4, 4, 12]


def test_timestamp_format_has_no_fractional_seconds() -> None:
    value = datetime(2026, 1, 1, 12, 30, 45, 123456, tzinfo=timezone.utc)
    assert format_timestamp(value) == "2026-01-01T12:30:45Z"


def test_timestamp_parser_rejects_fractional_seconds() -> None:
    assert parse_no_ms_timestamp("2026-01-01T12:30:45Z") is not None
    assert parse_no_ms_timestamp("2026-01-01T12:30:45.000Z") is None
