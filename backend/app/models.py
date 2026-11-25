from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    public_key_hex: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="CUSTOMER")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    merchant: Mapped[Merchant | None] = relationship(back_populates="user", uselist=False)
    account: Mapped[MockBankAccount | None] = relationship(back_populates="user", uselist=False)

    __table_args__ = (Index("idx_users_pubkey", "public_key_hex"),)


class Merchant(Base):
    __tablename__ = "merchants"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    merchant_code: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    business_name: Mapped[str] = mapped_column(String(150), nullable=False)
    terminal_pubkey_hex: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    settlement_account_num: Mapped[str] = mapped_column(String(10), nullable=False)
    risk_tier: Mapped[str] = mapped_column(String(20), nullable=False, default="STANDARD")
    max_offline_ticket_kobo: Mapped[int] = mapped_column(BigInteger, nullable=False, default=500_000)
    max_cumulative_offline_kobo: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=5_000_000
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    user: Mapped[User] = relationship(back_populates="merchant")


class MockBankAccount(Base):
    __tablename__ = "mock_bank_accounts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    account_number: Mapped[str] = mapped_column(String(10), nullable=False, unique=True)
    available_balance_kobo: Mapped[int] = mapped_column(BigInteger, nullable=False, default=5_000_000)
    reserved_balance_kobo: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    user: Mapped[User] = relationship(back_populates="account")


class Allocation(Base):
    __tablename__ = "allocations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    oac_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    allocated_amount_kobo: Mapped[int] = mapped_column(BigInteger, nullable=False)
    spent_amount_kobo: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="NGN")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="ACTIVE")
    issuer_key_version: Mapped[str] = mapped_column(String(10), nullable=False, default="v1")
    issuer_signature_hex: Mapped[str] = mapped_column(String(128), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    transactions: Mapped[list[Transaction]] = relationship(back_populates="allocation")

    __table_args__ = (
        Index("idx_allocations_oac_id", "oac_id"),
        Index("idx_allocations_user_id", "user_id"),
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    oac_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("allocations.oac_id", ondelete="RESTRICT"), nullable=False
    )
    seq_no: Mapped[int] = mapped_column(Integer, nullable=False)
    merchant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("merchants.id", ondelete="RESTRICT"), nullable=False
    )
    amount_kobo: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="NGN")
    invoice_nonce: Mapped[str] = mapped_column(String(64), nullable=False)
    customer_pubkey_hex: Mapped[str] = mapped_column(String(64), nullable=False)
    customer_signature_hex: Mapped[str] = mapped_column(String(128), nullable=False)
    relay_node_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    simulated_clearing_ref: Mapped[str | None] = mapped_column(String(64), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_offline_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    allocation: Mapped[Allocation] = relationship(back_populates="transactions")

    __table_args__ = (
        UniqueConstraint("oac_id", "seq_no", name="uq_transactions_oac_seq"),
        UniqueConstraint("merchant_id", "invoice_nonce", name="uq_transactions_merchant_nonce"),
        Index("idx_transactions_txid", "transaction_id"),
        Index("idx_transactions_status", "status"),
        Index("idx_transactions_merchant", "merchant_id"),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False)
    actor: Mapped[str] = mapped_column(String(50), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    __table_args__ = (
        Index("idx_audit_event", "event_type"),
        Index("idx_audit_created", "created_at"),
    )
