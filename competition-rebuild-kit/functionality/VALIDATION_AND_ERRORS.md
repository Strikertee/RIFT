# Validation and Errors

## Client-side validation

| Context | Rule | Failure behaviour |
| --- | --- | --- |
| Lock funds | amount > 0, integer kobo, ≤ remaining ₦50,000 cap, ≤ available | Inline `Notice`; button disabled |
| Sign | amount ≤ remaining offline allocation; active OAC | Throws error; UI shows notice |
| Invoice | amount > 0; keypad capped at 7 digits | Create button disabled at zero |
| Batch chunk | `RB.<total>.<index>.<payload>` with all indices present | Progress notice; incomplete set not ingested |
| Camera | Requires `window.isSecureContext` | Camera button disabled; paste fallback shown |
| Registration | 64-hex key, phone 6–20, display name 2–100 | API error mapped by `describeApiError()` |
| PIN (rehearsal client) | 4+ digits, confirm matches | Onboarding validation notice |

## Backend validation

| Endpoint | Validation | Error |
| --- | --- | --- |
| register | user_type enum, name/phone lengths, hex key, uniqueness | 409 codes, 422 VALIDATION_ERROR |
| allocations/issue | role CUSTOMER, ownership, amount >0, duration 1–24, funds | 400/403/409/422 |
| allocations status | owner only | 401/403/404 |
| relay | transaction list ≥1, hex key/signature, int seq/amount | 401 relay key, 422 VALIDATION_ERROR |
| sim/reset | admin secret | 403 FORBIDDEN |

## Relay validation results

`validation_result` values observed: `VALID`, `IDEMPOTENT_REPLAY`, `INVALID_SIGNATURE`, `OAC_EXPIRED`, `OVERSPEND`, `LEDGER_INCONSISTENT`, `DUPLICATE_SEQUENCE`, `DUPLICATE`.

`rejection_reason` values include `TRANSACTION_ID_MISMATCH`, `OAC_ID_MISMATCH`, `CUSTOMER_PUBKEY_MISMATCH`, `INVALID_OAC_TIMESTAMP`, `UNKNOWN_OAC`, `UNKNOWN_MERCHANT`, `INVALID_ISSUER_OAC_SIGNATURE`, `INVALID_CUSTOMER_SIGNATURE`, `OAC_CUSTOMER_MISMATCH`, `OAC_AMOUNT_MISMATCH`, `OAC_EXPIRED`, `OAC_<STATUS>`, `OAC_SEQUENCE_CONFLICT`, `DUPLICATE_INVOICE_NONCE`, `OAC_BALANCE_EXHAUSTED`, `RESERVE_UNDERFLOW`.

## Merchant local rejection reasons

`MALFORMED_TOKEN`, `INVALID_ISSUER_OAC_SIGNATURE`, `OAC_EXPIRED`, `MERCHANT_MISMATCH`, `AMOUNT_MISMATCH`, `NONCE_MISMATCH`, `TRANSACTION_ID_MISMATCH`, `AMOUNT_EXCEEDS_OAC`, `INVALID_CUSTOMER_TIMESTAMP`, `INVALID_CUSTOMER_SIGNATURE`, `INVOICE_ALREADY_CONSUMED`, `SEQ_ROLLBACK`, `ISSUER_KEY_UNAVAILABLE`.

## Error envelope

`ApiError` and `RequestValidationError` are wrapped with `error.code`, `error.message`, `error.details`, `error.timestamp`. FastAPI default 404/405 and unhandled 500 may not be wrapped.

## UI error treatment

- Toast provider shows error toasts regardless of notification preference.
- `Notice` component tones: info, error, success, rift.
- Merchant accept failure: reason lowercased with underscores replaced by spaces.
- Bank live failure: sticky demo fallback plus informational toast.
- Scanner non-secure context: explicit amber notice and disabled camera.
- Gateway invalid SIG entry: reason pill; relay still attempted.

## Do not silently change

- Do not convert relay rejections into HTTP errors; Core returns 200 with per-record results.
- Do not normalise `SETTLED (SIMULATED)` to `SETTLED`; exact string is contractual.
- Do not use `Date.toISOString()` for OAC timestamps.
