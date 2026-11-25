from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Uuid,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    public_key_hex: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="CUSTOMER")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    bank_account: Mapped[MockBankAccount | None] = relationship(back_populates="user", uselist=False)
    allocations: Mapped[list[Allocation]] = relationship(back_populates="user")

    __table_args__ = (Index("idx_users_pubkey", "public_key_hex"),)


class Merchant(Base):
    __tablename__ = "merchants"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), primary_key=True
    )
    merchant_code: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    business_name: Mapped[str] = mapped_column(String(150), nullable=False)
    terminal_pubkey_hex: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    settlement_account_num: Mapped[str] = mapped_column(String(10), nullable=False)
    risk_tier: Mapped[str] = mapped_column(String(20), nullable=False, default="STANDARD")
    max_offline_ticket_kobo: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=500_000
    )
    max_cumulative_offline_kobo: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=5_000_000
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class MockBankAccount(Base):
    __tablename__ = "mock_bank_accounts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    account_number: Mapped[str] = mapped_column(String(10), nullable=False, unique=True)
    available_balance_kobo: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=5_000_000
    )
    reserved_balance_kobo: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped[User] = relationship(back_populates="bank_account")

    __table_args__ = (
        CheckConstraint("available_balance_kobo >= 0", name="ck_mock_accounts_available_nonnegative"),
        CheckConstraint("reserved_balance_kobo >= 0", name="ck_mock_accounts_reserved_nonnegative"),
    )


class Allocation(Base):
    __tablename__ = "allocations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    oac_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    allocated_amount_kobo: Mapped[int] = mapped_column(BigInteger, nullable=False)
    spent_amount_kobo: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="NGN")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="ACTIVE")
    issuer_key_version: Mapped[str] = mapped_column(String(10), nullable=False, default="v1")
    issuer_signature_hex: Mapped[str] = mapped_column(String(128), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="allocations")

    __table_args__ = (
        CheckConstraint("allocated_amount_kobo > 0", name="ck_allocations_amount_positive"),
        CheckConstraint("spent_amount_kobo >= 0", name="ck_allocations_spent_nonnegative"),
        Index("idx_allocations_oac_id", "oac_id"),
        Index("idx_allocations_user_id", "user_id"),
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    transaction_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    oac_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("allocations.oac_id", ondelete="RESTRICT"), nullable=False
    )
    seq_no: Mapped[int] = mapped_column(Integer, nullable=False)
    merchant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("merchants.id", ondelete="RESTRICT"), nullable=False
    )
    amount_kobo: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="NGN")
    invoice_nonce: Mapped[str] = mapped_column(String(64), nullable=False)
    customer_pubkey_hex: Mapped[str] = mapped_column(String(64), nullable=False)
    customer_signature_hex: Mapped[str] = mapped_column(String(128), nullable=False)
    relay_node_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="RECEIVED")
    simulated_clearing_ref: Mapped[str | None] = mapped_column(String(64), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_offline_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("seq_no > 0", name="ck_transactions_seq_positive"),
        CheckConstraint("amount_kobo > 0", name="ck_transactions_amount_positive"),
        UniqueConstraint("oac_id", "seq_no", name="uq_transactions_oac_seq"),
        UniqueConstraint("merchant_id", "invoice_nonce", name="uq_transactions_merchant_nonce"),
        Index("idx_transactions_transaction_id", "transaction_id"),
        Index("idx_transactions_status", "status"),
        Index("idx_transactions_merchant", "merchant_id"),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False)
    actor: Mapped[str] = mapped_column(String(50), nullable=False)
    payload: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_audit_event", "event_type"),
        Index("idx_audit_created", "created_at"),
    )

