# API Contracts

Base URL: `/api/v1`. All requests and responses are JSON. Amounts are integer kobo. Timestamps are `YYYY-MM-DDTHH:MM:SSZ` with no fractional seconds.

Client sends `X-RIFT-Client-Version: 1.0.0` and `X-Idempotency-Key` on POST; the backend currently ignores both. Relay key, when configured, is sent as `X-Relay-Api-Key`.

## GET /api/v1/health

- Auth: none.
- Response 200: `status`, `environment`, `version`, `timestamp`, `database`, `issuer_key_loaded`, `issuer_pubkey_hex`.
- `status` is `healthy` only when DB connected and issuer key loaded; otherwise `degraded`, still HTTP 200.
- Source: `app/routers/health.py`.

## POST /api/v1/auth/register

- Auth: none.
- Request: `user_type` (`CUSTOMER`|`MERCHANT`), `display_name` (2–100), `phone_number` (6–20), `public_key_hex` (64 hex), optional `business_name`, optional `merchant_code`.
- Response 201: `user_id` (`usr_<uuid>` or `mch_<uuid>`), `user_type`, `display_name`, `phone_number`, `public_key_hex`, `mock_account_number`, `mock_balance_kobo`, `created_at`.
- Errors: 409 `PUBLIC_KEY_ALREADY_REGISTERED`, `PHONE_ALREADY_REGISTERED`, `MERCHANT_CODE_ALREADY_REGISTERED`; 422 `VALIDATION_ERROR`.
- Source: `app/routers/auth.py`.

## POST /api/v1/allocations/issue

- Auth: Bearer; role must be CUSTOMER.
- Request: `amount_kobo` (>0), `duration_hours` (1–24, default 6), optional `customer_id` must match bearer.
- Response 201: `oac_id`, `customer_id`, `customer_pubkey_hex`, `allocated_amount_kobo`, `currency`, `issued_at`, `expires_at`, `issuer_key_version`, `issuer_signature_hex`, `available_balance_kobo`, `reserved_balance_kobo`.
- Errors: 401 `UNAUTHORIZED`, 403 `FORBIDDEN`/`CUSTOMER_MISMATCH`, 400 `INVALID_CUSTOMER_ID`/`INSUFFICIENT_FUNDS`, 409 `MOCK_ACCOUNT_MISSING`, 422 validation.
- Source: `app/routers/allocations.py`.

## GET /api/v1/allocations/{oac_id}

- Auth: Bearer; owner only, no admin bypass.
- Response 200: `oac_id`, `customer_id`, `allocated_amount_kobo`, `spent_amount_kobo`, `remaining_amount_kobo`, `currency`, `status`, `issued_at`, `expires_at`, `issuer_key_version`, `available_balance_kobo`, `reserved_balance_kobo`.
- Errors: 401, 404 `OAC_NOT_FOUND`, 403 `FORBIDDEN`, 409 `MOCK_ACCOUNT_MISSING`.
- Active expired allocations are marked `EXPIRED` but reserved funds are not refunded.

## POST /api/v1/transactions/relay

- Auth: no Bearer. If `RELAY_API_KEY` is configured, require `X-Relay-Api-Key`; otherwise open.
- Request: `relay_node_id?`, `relayed_at?` (accepted, ignored), `transactions` (min 1).
- Each transaction: `transaction_id`, `oac_id`, `seq_no`, `merchant_id`, `amount_kobo`, `currency`, `invoice_nonce`, `customer_timestamp` (int or ISO string), `customer_pubkey_hex`, `customer_signature_hex`, `oac_token`.
- `oac_token`: `oac_id`, `customer_id`, `customer_pubkey_hex`, `allocated_amount_kobo`, `currency`, `issued_at`, `expires_at`, `issuer_key_version` (alias `issuer_pubkey_version`), `issuer_signature_hex`.
- Response 200: `batch_id`, `total_received`, `results[]` with `transaction_id`, `status`, `validation_result`, `simulated_clearing_reference`, `settled_at`, `rejection_reason`.
- Errors: 401 `UNAUTHORIZED_RELAY`, 422 validation. Rejections are per-record, not top-level HTTP errors.
- Source: `app/routers/transactions.py`, `app/services/ingestion.py`.

## GET /api/v1/transactions/{transaction_id}/status

- Auth: Bearer; allowed if allocation owner, merchant owner or ADMIN.
- Response 200: `transaction_id`, `oac_id`, `seq_no`, `amount_kobo`, `currency`, `merchant_id`, `status`, `simulated_clearing_ref`, `created_offline_at`, `ingested_at`, `settled_at`.
- Errors: 401, 404 `TRANSACTION_NOT_FOUND`, 403.
- Note: many rejected records are not persisted and return 404; only overspend is persisted as a rejected row.

## GET /api/v1/merchants/{merchant_id}/settlements

- Auth: Bearer; merchant owner or ADMIN.
- Accepts `mch_<uuid>` or bare UUID.
- Response 200: `merchant_id`, `total_settled_kobo`, `count`, `settlements[]`.
- Items: `transaction_id`, `oac_id`, `seq_no`, `amount_kobo`, `currency`, `status`, `simulated_clearing_ref`, `settled_at`.
- Only `SETTLED (SIMULATED)` rows are included.

## POST /api/v1/sim/reset

- Auth: `X-Admin-Secret`.
- Response 200: `status: ledger_reseeded`, `mock_users_reset` (actually bank-account count), `transactions_purged`, `allocations_reset`, `timestamp`.
- Deletes transactions, allocations and audit logs; resets all mock accounts; leaves users and merchants.

## Standard error envelope

`ApiError` and Pydantic validation errors are wrapped as:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": {},
    "timestamp": "2026-01-01T00:00:00Z"
  }
}
```

FastAPI default 404/405 and unhandled 500 responses may not use this envelope.

## Frontend-to-backend mapping

| Frontend function | Endpoint |
| --- | --- |
| `getHealth()` | GET /health |
| `register()` | POST /auth/register |
| `issueAllocation()` | POST /allocations/issue |
| `getAllocationStatus()` | GET /allocations/{oac_id} |
| `relayTransactions()` | POST /transactions/relay |
| `getTransactionStatus()` | GET /transactions/{id}/status |
| `getMerchantSettlements()` | GET /merchants/{id}/settlements |

Bank dev proxy forwards `/api` to `http://localhost:8000`; `getApiBaseUrl()` rewrites localhost bases to the current origin when accessed from a LAN hostname.
