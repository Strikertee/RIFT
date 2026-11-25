from __future__ import annotations

from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

StrictModelConfig = ConfigDict(populate_by_name=True, extra="ignore")


class HealthResponse(BaseModel):
    status: str
    environment: str
    version: str
    timestamp: str
    database: str
    issuer_key_loaded: bool
    issuer_pubkey_hex: str | None


class RegisterRequest(BaseModel):
    model_config = StrictModelConfig

    user_type: Literal["CUSTOMER", "MERCHANT"]
    display_name: str = Field(min_length=2, max_length=100)
    phone_number: str = Field(min_length=6, max_length=20)
    public_key_hex: str = Field(pattern=r"^[0-9a-fA-F]{64}$")
    business_name: str | None = Field(default=None, max_length=150)
    merchant_code: str | None = Field(default=None, max_length=32)


class RegisterResponse(BaseModel):
    user_id: str
    user_type: str
    display_name: str
    phone_number: str
    public_key_hex: str
    mock_account_number: str
    mock_balance_kobo: int
    created_at: str


class AllocationIssueRequest(BaseModel):
    model_config = StrictModelConfig

    amount_kobo: int = Field(gt=0)
    duration_hours: int = Field(default=6, ge=1, le=24)
    customer_id: str | None = None


class AllocationIssueResponse(BaseModel):
    oac_id: str
    customer_id: str
    customer_pubkey_hex: str
    allocated_amount_kobo: int
    currency: str
    issued_at: str
    expires_at: str
    issuer_key_version: str
    issuer_signature_hex: str
    available_balance_kobo: int
    reserved_balance_kobo: int


class AllocationStatusResponse(BaseModel):
    oac_id: str
    customer_id: str
    allocated_amount_kobo: int
    spent_amount_kobo: int
    remaining_amount_kobo: int
    currency: str
    status: str
    issued_at: str
    expires_at: str
    issuer_key_version: str
    available_balance_kobo: int
    reserved_balance_kobo: int


class OacTokenIn(BaseModel):
    model_config = StrictModelConfig

    oac_id: str
    customer_id: str
    customer_pubkey_hex: str = Field(pattern=r"^[0-9a-fA-F]{64}$")
    allocated_amount_kobo: int = Field(gt=0)
    currency: str
    issued_at: str
    expires_at: str
    issuer_key_version: str = Field(
        validation_alias=AliasChoices("issuer_key_version", "issuer_pubkey_version")
    )
    issuer_signature_hex: str = Field(pattern=r"^[0-9a-fA-F]{128}$")


class TransactionIn(BaseModel):
    model_config = StrictModelConfig

    transaction_id: str
    oac_id: str
    seq_no: int = Field(gt=0)
    merchant_id: str
    amount_kobo: int = Field(gt=0)
    currency: str
    invoice_nonce: str
    customer_timestamp: int | str
    customer_pubkey_hex: str = Field(pattern=r"^[0-9a-fA-F]{64}$")
    customer_signature_hex: str = Field(pattern=r"^[0-9a-fA-F]{128}$")
    oac_token: OacTokenIn


class RelayBatchRequest(BaseModel):
    model_config = StrictModelConfig

    relay_node_id: str | None = Field(default=None, max_length=50)
    relayed_at: int | str | None = None
    transactions: list[TransactionIn] = Field(min_length=1)


class RelayResult(BaseModel):
    transaction_id: str
    status: str
    validation_result: str
    simulated_clearing_reference: str | None
    settled_at: str | None
    rejection_reason: str | None


class RelayResponse(BaseModel):
    batch_id: str
    total_received: int
    results: list[RelayResult]


class TransactionStatusResponse(BaseModel):
    transaction_id: str
    oac_id: str
    seq_no: int
    amount_kobo: int
    currency: str
    merchant_id: str
    status: str
    simulated_clearing_ref: str | None
    created_offline_at: str
    ingested_at: str
    settled_at: str | None


class SettlementItem(BaseModel):
    transaction_id: str
    oac_id: str
    seq_no: int
    amount_kobo: int
    currency: str
    status: str
    simulated_clearing_ref: str | None
    settled_at: str | None


class SettlementResponse(BaseModel):
    merchant_id: str
    total_settled_kobo: int
    count: int
    settlements: list[SettlementItem]


class SimResetResponse(BaseModel):
    status: str
    mock_users_reset: int
    transactions_purged: int
    allocations_reset: int
    timestamp: str
