from __future__ import annotations

import uuid
from datetime import datetime, timezone

from nacl.signing import VerifyKey
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.crypto import (
    CryptoConfigurationError,
    derive_transaction_id,
    format_user_id,
    load_issuer_verifying_key,
    oac_payload_from_mapping,
    parse_identifier_uuid,
    transaction_payload,
    verify_payload_signature,
)
from app.db import get_sessionmaker
from app.models import Allocation, Merchant, MockBankAccount, Transaction, User
from app.schemas import RelayBatchRequest, RelayResult, TransactionIn
from app.services.ledger import generate_clearing_reference, write_audit
from app.timeutil import as_utc, format_timestamp, parse_customer_timestamp, parse_no_ms_timestamp, utc_now

CANONICAL_SETTLED = "SETTLED (SIMULATED)"


def _result(
    transaction_id: str,
    status: str,
    validation_result: str,
    *,
    clearing_reference: str | None = None,
    settled_at: datetime | None = None,
    rejection_reason: str | None = None,
) -> RelayResult:
    return RelayResult(
        transaction_id=transaction_id,
        status=status,
        validation_result=validation_result,
        simulated_clearing_reference=clearing_reference,
        settled_at=format_timestamp(settled_at) if settled_at is not None else None,
        rejection_reason=rejection_reason,
    )


def _reject(
    transaction_id: str,
    status: str,
    validation_result: str,
    rejection_reason: str,
) -> RelayResult:
    return _result(
        transaction_id,
        status,
        validation_result,
        rejection_reason=rejection_reason,
    )


def _invalid_signature(transaction_id: str, reason: str) -> RelayResult:
    return _reject(transaction_id, "REJECTED_INVALID_SIG", "INVALID_SIGNATURE", reason)


async def _existing_result(transaction_id: str) -> RelayResult | None:
    async with get_sessionmaker()() as db:
        existing = await db.scalar(
            select(Transaction).where(Transaction.transaction_id == transaction_id)
        )
        if existing is None:
            return None
        return _result(
            transaction_id=transaction_id,
            status="IDEMPOTENT_REPLAY",
            validation_result="IDEMPOTENT_REPLAY",
            clearing_reference=existing.simulated_clearing_ref,
            settled_at=existing.settled_at,
            rejection_reason=existing.rejection_reason,
        )


def _verify_cryptography(transaction: TransactionIn, settings: Settings) -> RelayResult | None:
    transaction_id = transaction.transaction_id
    expected_id = derive_transaction_id(
        transaction.oac_id, transaction.seq_no, transaction.invoice_nonce
    )
    if expected_id != transaction_id:
        return _invalid_signature(transaction_id, "TRANSACTION_ID_MISMATCH")

    token = transaction.oac_token
    if token.oac_id != transaction.oac_id:
        return _invalid_signature(transaction_id, "OAC_ID_MISMATCH")
    if token.issuer_key_version != settings.issuer_key_version:
        return _invalid_signature(transaction_id, "INVALID_ISSUER_OAC_SIGNATURE")

    issued_at = parse_no_ms_timestamp(token.issued_at)
    expires_at = parse_no_ms_timestamp(token.expires_at)
    if issued_at is None or expires_at is None:
        return _invalid_signature(transaction_id, "INVALID_OAC_TIMESTAMP")

    try:
        verifying_key = load_issuer_verifying_key(settings)
    except CryptoConfigurationError:
        return _invalid_signature(transaction_id, "INVALID_ISSUER_OAC_SIGNATURE")

    canonical_oac = oac_payload_from_mapping(token.model_dump())
    if not verify_payload_signature(verifying_key, canonical_oac, token.issuer_signature_hex):
        return _invalid_signature(transaction_id, "INVALID_ISSUER_OAC_SIGNATURE")

    customer_timestamp = parse_customer_timestamp(transaction.customer_timestamp)
    if customer_timestamp is None or customer_timestamp <= 0:
        return _invalid_signature(transaction_id, "INVALID_CUSTOMER_SIGNATURE")

    canonical_transaction = transaction_payload(
        oac_id=transaction.oac_id,
        seq_no=transaction.seq_no,
        invoice_nonce=transaction.invoice_nonce,
        merchant_id=transaction.merchant_id,
        amount_kobo=transaction.amount_kobo,
        currency=transaction.currency,
        customer_timestamp=customer_timestamp,
    )
    try:
        customer_key = VerifyKey(bytes.fromhex(token.customer_pubkey_hex))
    except ValueError:
        return _invalid_signature(transaction_id, "INVALID_CUSTOMER_SIGNATURE")
    if not verify_payload_signature(
        customer_key, canonical_transaction, transaction.customer_signature_hex
    ):
        return _invalid_signature(transaction_id, "INVALID_CUSTOMER_SIGNATURE")
    return None


def _created_offline_at(timestamp: int | str) -> datetime:
    parsed = parse_customer_timestamp(timestamp) or 0
    return datetime.fromtimestamp(parsed, tz=timezone.utc)


async def _audit_collision(
    transaction: TransactionIn,
    actor: str,
    reason: str,
) -> None:
    async with get_sessionmaker()() as db:
        async with db.begin():
            await write_audit(
                db,
                "COLLISION_DETECTED" if reason == "OAC_SEQUENCE_CONFLICT" else "TX_REJECTED",
                transaction.transaction_id,
                actor,
                {
                    "oac_id": transaction.oac_id,
                    "seq_no": transaction.seq_no,
                    "invoice_nonce": transaction.invoice_nonce,
                    "reason": reason,
                },
            )


async def _collision_after_integrity_error(
    transaction: TransactionIn,
) -> RelayResult:
    async with get_sessionmaker()() as db:
        sequence_duplicate = await db.scalar(
            select(Transaction.id).where(
                Transaction.oac_id == transaction.oac_id,
                Transaction.seq_no == transaction.seq_no,
            )
        )
    if sequence_duplicate is not None:
        await _audit_collision(transaction, "core", "OAC_SEQUENCE_CONFLICT")
        return _reject(
            transaction.transaction_id,
            "QUARANTINED_COLLISION",
            "DUPLICATE_SEQUENCE",
            "OAC_SEQUENCE_CONFLICT",
        )
    await _audit_collision(transaction, "core", "DUPLICATE_INVOICE_NONCE")
    return _reject(
        transaction.transaction_id,
        "REJECTED_DUPLICATE",
        "DUPLICATE",
        "DUPLICATE_INVOICE_NONCE",
    )


async def _commit_or_reject(
    transaction: TransactionIn,
    *,
    actor: str,
    customer_id: uuid.UUID,
    merchant_id: uuid.UUID,
) -> RelayResult:
    token = transaction.oac_token
    try:
        async with get_sessionmaker()() as db:
            async with db.begin():
                allocation = await db.scalar(
                    select(Allocation)
                    .where(Allocation.oac_id == transaction.oac_id)
                    .with_for_update()
                )
                merchant = await db.get(Merchant, merchant_id)
                customer = await db.get(User, customer_id)
                if allocation is None or merchant is None or customer is None:
                    return _invalid_signature(transaction.transaction_id, "UNKNOWN_OAC")
                if customer.public_key_hex.lower() != token.customer_pubkey_hex.lower():
                    return _invalid_signature(transaction.transaction_id, "CUSTOMER_PUBKEY_MISMATCH")
                if allocation.user_id != customer.id:
                    return _invalid_signature(transaction.transaction_id, "OAC_CUSTOMER_MISMATCH")

                persisted_oac = {
                    "oac_id": allocation.oac_id,
                    "customer_id": format_user_id(customer.id, customer.role),
                    "customer_pubkey_hex": customer.public_key_hex,
                    "allocated_amount_kobo": allocation.allocated_amount_kobo,
                    "currency": allocation.currency,
                    "issued_at": format_timestamp(as_utc(allocation.issued_at)),
                    "expires_at": format_timestamp(as_utc(allocation.expires_at)),
                    "issuer_key_version": allocation.issuer_key_version,
                }
                for key, expected in persisted_oac.items():
                    if token.model_dump()[key] != expected:
                        return _invalid_signature(transaction.transaction_id, f"OAC_{key.upper()}_MISMATCH")

                expires_at = as_utc(allocation.expires_at)
                if expires_at <= utc_now():
                    if allocation.status == "ACTIVE":
                        allocation.status = "EXPIRED"
                    return _reject(
                        transaction.transaction_id,
                        "REJECTED_INVALID_SIG",
                        "OAC_EXPIRED",
                        "OAC_EXPIRED",
                    )
                if allocation.status != "ACTIVE":
                    return _reject(
                        transaction.transaction_id,
                        "REJECTED_INVALID_SIG",
                        "OAC_EXPIRED",
                        f"OAC_{allocation.status}",
                    )

                sequence_duplicate = await db.scalar(
                    select(Transaction.id).where(
                        Transaction.oac_id == allocation.oac_id,
                        Transaction.seq_no == transaction.seq_no,
                    )
                )
                if sequence_duplicate is not None:
                    await write_audit(
                        db,
                        "COLLISION_DETECTED",
                        transaction.transaction_id,
                        actor,
                        {
                            "oac_id": allocation.oac_id,
                            "seq_no": transaction.seq_no,
                            "reason": "OAC_SEQUENCE_CONFLICT",
                        },
                    )
                    return _reject(
                        transaction.transaction_id,
                        "QUARANTINED_COLLISION",
                        "DUPLICATE_SEQUENCE",
                        "OAC_SEQUENCE_CONFLICT",
                    )

                nonce_duplicate = await db.scalar(
                    select(Transaction.id).where(
                        Transaction.merchant_id == merchant.id,
                        Transaction.invoice_nonce == transaction.invoice_nonce,
                    )
                )
                if nonce_duplicate is not None:
                    await write_audit(
                        db,
                        "TX_REJECTED",
                        transaction.transaction_id,
                        actor,
                        {"reason": "DUPLICATE_INVOICE_NONCE"},
                    )
                    return _reject(
                        transaction.transaction_id,
                        "REJECTED_DUPLICATE",
                        "DUPLICATE",
                        "DUPLICATE_INVOICE_NONCE",
                    )

                remaining = allocation.allocated_amount_kobo - allocation.spent_amount_kobo
                if transaction.amount_kobo > remaining:
                    rejected = Transaction(
                        transaction_id=transaction.transaction_id,
                        oac_id=allocation.oac_id,
                        seq_no=transaction.seq_no,
                        merchant_id=merchant.id,
                        amount_kobo=transaction.amount_kobo,
                        currency=transaction.currency,
                        invoice_nonce=transaction.invoice_nonce,
                        customer_pubkey_hex=token.customer_pubkey_hex,
                        customer_signature_hex=transaction.customer_signature_hex,
                        relay_node_id=actor if actor != "core" else None,
                        status="REJECTED_OVERSPEND",
                        rejection_reason="OAC_BALANCE_EXHAUSTED",
                        created_offline_at=_created_offline_at(transaction.customer_timestamp),
                        ingested_at=utc_now(),
                    )
                    db.add(rejected)
                    await write_audit(
                        db,
                        "TX_REJECTED",
                        transaction.transaction_id,
                        actor,
                        {"reason": "OAC_BALANCE_EXHAUSTED", "amount_kobo": transaction.amount_kobo},
                    )
                    return _reject(
                        transaction.transaction_id,
                        "REJECTED_OVERSPEND",
                        "OVERSPEND",
                        "OAC_BALANCE_EXHAUSTED",
                    )

                customer_account = await db.scalar(
                    select(MockBankAccount).where(MockBankAccount.user_id == customer.id)
                )
                merchant_account = await db.scalar(
                    select(MockBankAccount).where(MockBankAccount.user_id == merchant.id)
                )
                if customer_account is None or merchant_account is None:
                    return _reject(
                        transaction.transaction_id,
                        "REJECTED_INVALID_SIG",
                        "LEDGER_INCONSISTENT",
                        "LEDGER_INCONSISTENT",
                    )
                if customer_account.reserved_balance_kobo < transaction.amount_kobo:
                    await write_audit(
                        db,
                        "TX_REJECTED",
                        transaction.transaction_id,
                        actor,
                        {"reason": "RESERVE_UNDERFLOW"},
                    )
                    return _reject(
                        transaction.transaction_id,
                        "REJECTED_INVALID_SIG",
                        "LEDGER_INCONSISTENT",
                        "RESERVE_UNDERFLOW",
                    )

                now = utc_now()
                clearing_reference = generate_clearing_reference()
                record = Transaction(
                    transaction_id=transaction.transaction_id,
                    oac_id=allocation.oac_id,
                    seq_no=transaction.seq_no,
                    merchant_id=merchant.id,
                    amount_kobo=transaction.amount_kobo,
                    currency=transaction.currency,
                    invoice_nonce=transaction.invoice_nonce,
                    customer_pubkey_hex=token.customer_pubkey_hex,
                    customer_signature_hex=transaction.customer_signature_hex,
                    relay_node_id=actor if actor != "core" else None,
                    status="CRYPTO_VALIDATED",
                    created_offline_at=_created_offline_at(transaction.customer_timestamp),
                    ingested_at=now,
                )
                db.add(record)
                await db.flush()

                allocation.spent_amount_kobo += transaction.amount_kobo
                customer_account.reserved_balance_kobo -= transaction.amount_kobo
                merchant_account.available_balance_kobo += transaction.amount_kobo
                await write_audit(
                    db,
                    "PROVIDER_AUTHORISED",
                    transaction.transaction_id,
                    actor,
                    {"status": "PROVIDER_AUTHORISED (SIMULATION)"},
                )

                record.status = CANONICAL_SETTLED
                record.simulated_clearing_ref = clearing_reference
                record.settled_at = now
                await write_audit(
                    db,
                    "TX_SETTLED",
                    transaction.transaction_id,
                    actor,
                    {"simulated_clearing_ref": clearing_reference},
                )
                return _result(
                    transaction.transaction_id,
                    CANONICAL_SETTLED,
                    "VALID",
                    clearing_reference=clearing_reference,
                    settled_at=now,
                )
    except IntegrityError:
        return await _collision_after_integrity_error(transaction)


async def _ingest_one(transaction: TransactionIn, relay_node_id: str | None) -> RelayResult:
    existing = await _existing_result(transaction.transaction_id)
    if existing is not None:
        return existing

    settings = get_settings()
    crypto_rejection = _verify_cryptography(transaction, settings)
    if crypto_rejection is not None:
        return crypto_rejection

    token = transaction.oac_token
    if token.customer_id.startswith("usr_"):
        customer_raw = token.customer_id[4:]
    else:
        customer_raw = token.customer_id
    if transaction.merchant_id.startswith("usr_"):
        return _invalid_signature(transaction.transaction_id, "UNKNOWN_MERCHANT")
    try:
        customer_id = uuid.UUID(customer_raw)
        merchant_id = parse_identifier_uuid(transaction.merchant_id)
    except ValueError:
        return _invalid_signature(transaction.transaction_id, "UNKNOWN_MERCHANT")

    actor = relay_node_id or "core"
    return await _commit_or_reject(
        transaction,
        actor=actor,
        customer_id=customer_id,
        merchant_id=merchant_id,
    )


async def ingest_transactions(payload: RelayBatchRequest) -> tuple[str, list[RelayResult]]:
    batch_id = f"batch_{uuid.uuid4().hex}"
    results: list[RelayResult] = []
    for transaction in payload.transactions:
        results.append(await _ingest_one(transaction, payload.relay_node_id))
    return batch_id, results
