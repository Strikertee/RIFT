from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("phone_number", sa.String(length=20), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("public_key_hex", sa.String(length=64), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("phone_number"),
        sa.UniqueConstraint("public_key_hex"),
    )
    op.create_index("idx_users_pubkey", "users", ["public_key_hex"], unique=False)

    op.create_table(
        "merchants",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("merchant_code", sa.String(length=32), nullable=False),
        sa.Column("business_name", sa.String(length=150), nullable=False),
        sa.Column("terminal_pubkey_hex", sa.String(length=64), nullable=False),
        sa.Column("settlement_account_num", sa.String(length=10), nullable=False),
        sa.Column("risk_tier", sa.String(length=20), nullable=False),
        sa.Column("max_offline_ticket_kobo", sa.BigInteger(), nullable=False),
        sa.Column("max_cumulative_offline_kobo", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("merchant_code"),
        sa.UniqueConstraint("terminal_pubkey_hex"),
    )

    op.create_table(
        "mock_bank_accounts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("account_number", sa.String(length=10), nullable=False),
        sa.Column("available_balance_kobo", sa.BigInteger(), nullable=False),
        sa.Column("reserved_balance_kobo", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("available_balance_kobo >= 0", name="ck_mock_accounts_available_nonnegative"),
        sa.CheckConstraint("reserved_balance_kobo >= 0", name="ck_mock_accounts_reserved_nonnegative"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
        sa.UniqueConstraint("account_number"),
    )

    op.create_table(
        "allocations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("oac_id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("allocated_amount_kobo", sa.BigInteger(), nullable=False),
        sa.Column("spent_amount_kobo", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("issuer_key_version", sa.String(length=10), nullable=False),
        sa.Column("issuer_signature_hex", sa.String(length=128), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("allocated_amount_kobo > 0", name="ck_allocations_amount_positive"),
        sa.CheckConstraint("spent_amount_kobo >= 0", name="ck_allocations_spent_nonnegative"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("oac_id"),
    )
    op.create_index("idx_allocations_oac_id", "allocations", ["oac_id"], unique=False)
    op.create_index("idx_allocations_user_id", "allocations", ["user_id"], unique=False)

    op.create_table(
        "transactions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("transaction_id", sa.String(length=64), nullable=False),
        sa.Column("oac_id", sa.String(length=64), nullable=False),
        sa.Column("seq_no", sa.Integer(), nullable=False),
        sa.Column("merchant_id", sa.Uuid(), nullable=False),
        sa.Column("amount_kobo", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("invoice_nonce", sa.String(length=64), nullable=False),
        sa.Column("customer_pubkey_hex", sa.String(length=64), nullable=False),
        sa.Column("customer_signature_hex", sa.String(length=128), nullable=False),
        sa.Column("relay_node_id", sa.String(length=50), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("simulated_clearing_ref", sa.String(length=64), nullable=True),
        sa.Column("rejection_reason", sa.String(length=255), nullable=True),
        sa.Column("created_offline_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("settled_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("seq_no > 0", name="ck_transactions_seq_positive"),
        sa.CheckConstraint("amount_kobo > 0", name="ck_transactions_amount_positive"),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["oac_id"], ["allocations.oac_id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("transaction_id"),
        sa.UniqueConstraint("oac_id", "seq_no", name="uq_transactions_oac_seq"),
        sa.UniqueConstraint("merchant_id", "invoice_nonce", name="uq_transactions_merchant_nonce"),
    )
    op.create_index("idx_transactions_transaction_id", "transactions", ["transaction_id"], unique=False)
    op.create_index("idx_transactions_status", "transactions", ["status"], unique=False)
    op.create_index("idx_transactions_merchant", "transactions", ["merchant_id"], unique=False)

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=False),
        sa.Column("actor", sa.String(length=50), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_audit_event", "audit_logs", ["event_type"], unique=False)
    op.create_index("idx_audit_created", "audit_logs", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_audit_created", table_name="audit_logs")
    op.drop_index("idx_audit_event", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index("idx_transactions_merchant", table_name="transactions")
    op.drop_index("idx_transactions_status", table_name="transactions")
    op.drop_index("idx_transactions_transaction_id", table_name="transactions")
    op.drop_table("transactions")
    op.drop_index("idx_allocations_user_id", table_name="allocations")
    op.drop_index("idx_allocations_oac_id", table_name="allocations")
    op.drop_table("allocations")
    op.drop_table("mock_bank_accounts")
    op.drop_table("merchants")
    op.drop_index("idx_users_pubkey", table_name="users")
    op.drop_table("users")
