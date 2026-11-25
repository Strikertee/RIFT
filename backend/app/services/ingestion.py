from __future__ import annotations

import secrets
import time
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from ..config import settings
from ..db import SessionLocal
from ..ids import derive_transaction_id, merchant_id_for, parse_uuid, user_id_for
from ..models import Allocation, AuditLog, Merchant, MockBankAccount, Transaction, User
from ..schemas import RelayTransactionIn
from ..security import (
    iso_z,
    issuer_public_hex,
    oac_payload,
    parse_iso,
    tx_payload,
    verify_ed25519,
)

UTC = timezone.utc
HEX = set("0123456789abcdef")


def _now() -> datetime:
    return datetime.now(UTC)


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _is_hex(value: str, length: int) -> bool:
    return isinstance(value, str) and len(value) == length and set(value.lower()) <= HEX


def _customer_timestamp(value: int | str) -> int:
    if isinstance(value, bool):
        raise ValueError("invalid timestamp")
    if isinstance(value, int):
        return value
    text = str(value).strip()
    if text.lstrip("-").isdigit():
        return int(text)
    return int(parse_iso(text).timestamp())


def _result(
    transaction_id: str,
    status: str,
    validation_result: str,
    *,
    clearing_ref: str | None = None,
    settled_at: str | None = None,
    rejection_reason: str | None = None,
) -> dict:
    return {
        "transaction_id": transaction_id,
        "status": status,
        "validation_result": validation_result,
        "simulated_clearing_reference": clearing_ref,
        "settled_at": settled_at,
        "rejection_reason": rejection_reason,
    }


def _reject(
    transaction_id: str,
    validation_result: str,
    rejection_reason: str,
    *,
    status: str = "REJECTED_INVALID_SIG",
) -> dict:
    return _result(
        transaction_id,
        status,
        validation_result,
        rejection_reason=rejection_reason,
    )


def _audit(db: Session, event_type: str, entity_id: str, actor: str, payload: dict) -> None:
    db.add(
        AuditLog(
            event_type=event_type,
            entity_id=entity_id[:64],
            actor=actor[:50],
            payload=payload,
            created_at=_now(),
        )
    )


def _persist_overspend(
    db: Session,
    item: RelayTransactionIn,
    *,
    merchant_uuid,
    timestamp: int,
    reason: str,
) -> dict:
    try:
        db.add(
            Transaction(
                transaction_id=item.transaction_id,
                oac_id=item.oac_id,
                seq_no=item.seq_no,
                merchant_id=merchant_uuid,
                amount_kobo=item.amount_kobo,
                currency=item.currency,
                invoice_nonce=item.invoice_nonce,
                customer_pubkey_hex=item.customer_pubkey_hex,
                customer_signature_hex=item.customer_signature_hex,
                relay_node_id=None,
                status="REJECTED_OVERSPEND",
                rejection_reason=reason[:255],
                created_offline_at=datetime.fromtimestamp(timestamp, UTC),
                ingested_at=_now(),
            )
        )
        _audit(
            db,
            "TX_REJECTED",
            item.transaction_id,
            "CORE",
            {"reason": reason, "oac_id": item.oac_id, "seq_no": item.seq_no},
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        return _reject(
            item.transaction_id,
            "DUPLICATE_SEQUENCE",
            "OAC_SEQUENCE_CONFLICT",
            status="QUARANTINED_COLLISION",
        )
    return _reject(
        item.transaction_id,
        "OVERSPEND",
        reason,
        status="REJECTED_OVERSPEND",
    )


def _process(db: Session, item: RelayTransactionIn) -> dict:
    existing = db.scalar(
        select(Transaction).where(Transaction.transaction_id == item.transaction_id)
    )
    if existing is not None:
        return _result(
            item.transaction_id,
            "IDEMPOTENT_REPLAY",
            "IDEMPOTENT_REPLAY",
            clearing_ref=existing.simulated_clearing_ref,
            settled_at=iso_z(existing.settled_at) if existing.settled_at else None,
        )

    oac = item.oac_token.model_dump()
    oac["issuer_key_version"] = oac.get("issuer_key_version") or ""

    if (
        not item.transaction_id.startswith("tx_")
        or item.seq_no <= 0
        or item.amount_kobo <= 0
        or not item.invoice_nonce
        or not _is_hex(item.customer_pubkey_hex, 64)
        or not _is_hex(item.customer_signature_hex, 128)
        or not _is_hex(oac["issuer_signature_hex"], 128)
    ):
        return _reject(item.transaction_id, "INVALID_SIGNATURE", "MALFORMED_TRANSACTION")

    if oac["oac_id"] != item.oac_id or oac["customer_pubkey_hex"].lower() != item.customer_pubkey_hex.lower():
        return _reject(item.transaction_id, "INVALID_SIGNATURE", "OAC_TOKEN_MISMATCH")

    if item.currency != "NGN" or oac["currency"] != "NGN":
        return _reject(item.transaction_id, "INVALID_SIGNATURE", "UNSUPPORTED_CURRENCY")

    try:
        timestamp = _customer_timestamp(item.customer_timestamp)
        oac_issued = parse_iso(oac["issued_at"])
        oac_expires = parse_iso(oac["expires_at"])
    except (ValueError, TypeError, OverflowError):
        return _reject(item.transaction_id, "INVALID_OAC_TIMESTAMP", "INVALID_TIMESTAMP")

    now = _now()
    if timestamp <= 0 or timestamp > int(now.timestamp()) + 300:
        return _reject(
            item.transaction_id,
            "INVALID_CUSTOMER_TIMESTAMP",
            "CUSTOMER_TIMESTAMP_OUT_OF_RANGE",
        )

    if oac_expires <= oac_issued:
        return _reject(item.transaction_id, "INVALID_OAC_TIMESTAMP", "OAC_TIMESTAMP_ORDER")

    expected_txid = derive_transaction_id(item.oac_id, item.seq_no, item.invoice_nonce)
    if expected_txid != item.transaction_id:
        return _reject(item.transaction_id, "TRANSACTION_ID_MISMATCH", "TRANSACTION_ID_MISMATCH")

    allocation = db.scalar(select(Allocation).where(Allocation.oac_id == item.oac_id))
    if allocation is None:
        return _reject(item.transaction_id, "INVALID_SIGNATURE", "UNKNOWN_OAC")

    customer = db.get(User, allocation.user_id)
    if customer is None:
        return _reject(item.transaction_id, "INVALID_SIGNATURE", "UNKNOWN_CUSTOMER")

    customer_id = parse_uuid(oac["customer_id"])
    if customer_id is None or customer_id != allocation.user_id:
        return _reject(item.transaction_id, "INVALID_SIGNATURE", "OAC_CUSTOMER_MISMATCH")

    if customer.public_key_hex.lower() != oac["customer_pubkey_hex"].lower():
        return _reject(item.transaction_id, "INVALID_SIGNATURE", "OAC_PUBKEY_MISMATCH")

    if (
        int(oac["allocated_amount_kobo"]) != int(allocation.allocated_amount_kobo)
        or oac["currency"] != allocation.currency
        or _utc(oac_expires) != _utc(allocation.expires_at)
        or _utc(oac_issued) != _utc(allocation.issued_at)
    ):
        return _reject(item.transaction_id, "INVALID_SIGNATURE", "OAC_LEDGER_MISMATCH")

    if oac["issuer_key_version"] != allocation.issuer_key_version:
        return _reject(
            item.transaction_id,
            "INVALID_ISSUER_OAC_SIGNATURE",
            "ISSUER_KEY_VERSION_MISMATCH",
        )

    if oac["issuer_key_version"] != settings.issuer_key_version:
        return _reject(
            item.transaction_id,
            "INVALID_ISSUER_OAC_SIGNATURE",
            "UNKNOWN_ISSUER_KEY_VERSION",
        )

    if not verify_ed25519(oac_payload(oac), oac["issuer_signature_hex"], issuer_public_hex()):
        return _reject(
            item.transaction_id,
            "INVALID_ISSUER_OAC_SIGNATURE",
            "INVALID_ISSUER_OAC_SIGNATURE",
        )

    tx = {
        "amount_kobo": item.amount_kobo,
        "currency": item.currency,
        "customer_timestamp": timestamp,
        "invoice_nonce": item.invoice_nonce,
        "merchant_id": item.merchant_id,
        "oac_id": item.oac_id,
        "seq_no": item.seq_no,
    }
    if not verify_ed25519(tx, item.customer_signature_hex, item.customer_pubkey_hex):
        return _reject(
            item.transaction_id,
            "INVALID_CUSTOMER_SIGNATURE",
            "INVALID_CUSTOMER_SIGNATURE",
        )

    merchant_uuid = parse_uuid(item.merchant_id)
    merchant = db.get(Merchant, merchant_uuid) if merchant_uuid else None
    if merchant is None:
        return _reject(item.transaction_id, "INVALID_SIGNATURE", "UNKNOWN_MERCHANT")

    if allocation.status in {"EXPIRED", "REVOKED"} or _utc(allocation.expires_at) <= now:
        if allocation.status == "ACTIVE":
            allocation.status = "EXPIRED"
            db.commit()
        return _reject(
            item.transaction_id,
            "OAC_EXPIRED",
            "OAC_EXPIRED",
            status="REJECTED_OVERSPEND",
        )

    if item.amount_kobo > allocation.allocated_amount_kobo:
        return _persist_overspend(
            db,
            item,
            merchant_uuid=merchant_uuid,
            timestamp=timestamp,
            reason="AMOUNT_EXCEEDS_OAC",
        )

    seq_collision = db.scalar(
        select(Transaction).where(
            Transaction.oac_id == item.oac_id,
            Transaction.seq_no == item.seq_no,
        )
    )
    if seq_collision is not None:
        _audit(
            db,
            "COLLISION_DETECTED",
            item.transaction_id,
            "CORE",
            {
                "oac_id": item.oac_id,
                "seq_no": item.seq_no,
                "existing_transaction_id": seq_collision.transaction_id,
            },
        )
        db.commit()
        return _reject(
            item.transaction_id,
            "DUPLICATE_SEQUENCE",
            "OAC_SEQUENCE_CONFLICT",
            status="QUARANTINED_COLLISION",
        )

    nonce_collision = db.scalar(
        select(Transaction).where(
            Transaction.merchant_id == merchant_uuid,
            Transaction.invoice_nonce == item.invoice_nonce,
        )
    )
    if nonce_collision is not None:
        _audit(
            db,
            "TX_REJECTED",
            item.transaction_id,
            "CORE",
            {"reason": "DUPLICATE_INVOICE_NONCE", "existing_transaction_id": nonce_collision.transaction_id},
        )
        db.commit()
        return _reject(
            item.transaction_id,
            "DUPLICATE",
            "DUPLICATE_INVOICE_NONCE",
            status="REJECTED_DUPLICATE",
        )

    if allocation.spent_amount_kobo + item.amount_kobo > allocation.allocated_amount_kobo:
        return _persist_overspend(
            db,
            item,
            merchant_uuid=merchant_uuid,
            timestamp=timestamp,
            reason="OAC_BALANCE_EXHAUSTED",
        )

    customer_account = db.scalar(
        select(MockBankAccount).where(MockBankAccount.user_id == allocation.user_id)
    )
    merchant_account = db.scalar(
        select(MockBankAccount).where(MockBankAccount.user_id == merchant.id)
    )
    if customer_account is None or merchant_account is None:
        return _reject(
            item.transaction_id,
            "LEDGER_INCONSISTENT",
            "MOCK_ACCOUNT_MISSING",
            status="REJECTED_OVERSPEND",
        )
    if customer_account.reserved_balance_kobo < item.amount_kobo:
        return _reject(
            item.transaction_id,
            "RESERVE_UNDERFLOW",
            "RESERVE_UNDERFLOW",
            status="REJECTED_OVERSPEND",
        )

    settled_at = _now()
    clearing_ref = f"SIM-{int(time.time() * 1000):X}{secrets.token_hex(2).upper()}"
    row = Transaction(
        transaction_id=item.transaction_id,
        oac_id=item.oac_id,
        seq_no=item.seq_no,
        merchant_id=merchant_uuid,
        amount_kobo=item.amount_kobo,
        currency=item.currency,
        invoice_nonce=item.invoice_nonce,
        customer_pubkey_hex=item.customer_pubkey_hex,
        customer_signature_hex=item.customer_signature_hex,
        relay_node_id=None,
        status="SETTLED (SIMULATED)",
        simulated_clearing_ref=clearing_ref,
        created_offline_at=datetime.fromtimestamp(timestamp, UTC),
        ingested_at=settled_at,
        settled_at=settled_at,
    )
    db.add(row)

    allocation.spent_amount_kobo += item.amount_kobo
    if allocation.spent_amount_kobo >= allocation.allocated_amount_kobo:
        allocation.status = "EXHAUSTED"

    customer_account.reserved_balance_kobo -= item.amount_kobo
    merchant_account.available_balance_kobo += item.amount_kobo

    _audit(
        db,
        "PROVIDER_AUTHORISED",
        item.transaction_id,
        "SIMULATED_PROVIDER",
        {"amount_kobo": item.amount_kobo, "merchant_id": merchant_id_for(merchant.id)},
    )
    _audit(
        db,
        "TX_SETTLED",
        item.transaction_id,
        "CORE",
        {
            "amount_kobo": item.amount_kobo,
            "clearing_ref": clearing_ref,
            "oac_id": item.oac_id,
            "seq_no": item.seq_no,
        },
    )
    db.commit()

    return _result(
        item.transaction_id,
        "SETTLED (SIMULATED)",
        "VALID",
        clearing_ref=clearing_ref,
        settled_at=iso_z(settled_at),
    )


def process_transaction(item: RelayTransactionIn) -> dict:
    try:
        with SessionLocal() as db:
            return _process(db, item)
    except SQLAlchemyError:
        return _reject(item.transaction_id, "LEDGER_INCONSISTENT", "LEDGER_ERROR")
    except Exception:
        return _reject(item.transaction_id, "LEDGER_INCONSISTENT", "INTERNAL_ERROR")


def relay_batch(items: list[RelayTransactionIn]) -> list[dict]:
    return [process_transaction(item) for item in items]
