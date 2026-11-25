from __future__ import annotations

import re
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator

HEX64 = re.compile(r"^[0-9a-fA-F]{64}$")


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    user_type: Literal["CUSTOMER", "MERCHANT"]
    display_name: str = Field(min_length=2, max_length=100)
    phone_number: str = Field(min_length=6, max_length=20)
    public_key_hex: str
    business_name: str | None = Field(default=None, max_length=150)
    merchant_code: str | None = Field(default=None, max_length=32)

    @field_validator("public_key_hex")
    @classmethod
    def _validate_pubkey(cls, value: str) -> str:
        value = value.strip().lower()
        if not HEX64.match(value):
            raise ValueError("public_key_hex must be exactly 64 hex characters")
        return value

    @field_validator("phone_number", "display_name", "business_name", "merchant_code")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value


class AllocationIssueRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    amount_kobo: int = Field(gt=0)
    duration_hours: int = Field(default=6, ge=1, le=24)
    customer_id: str | None = None


class OacTokenIn(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    oac_id: str
    customer_id: str
    customer_pubkey_hex: str
    allocated_amount_kobo: int
    currency: str = "NGN"
    issued_at: str
    expires_at: str
    issuer_key_version: str = Field(
        validation_alias=AliasChoices("issuer_key_version", "issuer_pubkey_version")
    )
    issuer_signature_hex: str


class RelayTransactionIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    transaction_id: str
    oac_id: str
    seq_no: int
    merchant_id: str
    amount_kobo: int
    currency: str = "NGN"
    invoice_nonce: str
    customer_timestamp: int | str
    customer_pubkey_hex: str
    customer_signature_hex: str
    oac_token: OacTokenIn


class RelayRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    relay_node_id: str | None = None
    relayed_at: str | None = None
    transactions: list[RelayTransactionIn] = Field(min_length=1)
