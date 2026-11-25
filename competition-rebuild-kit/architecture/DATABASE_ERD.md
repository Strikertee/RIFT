# Database ERD

```mermaid
erDiagram
  USERS ||--o| MOCK_BANK_ACCOUNTS : owns
  USERS ||--o{ ALLOCATIONS : requests
  USERS ||--o| MERCHANTS : operates
  MERCHANTS ||--o{ TRANSACTIONS : receives
  ALLOCATIONS ||--o{ TRANSACTIONS : debited_by
  TRANSACTIONS ||--o{ AUDIT_LOGS : records

  USERS {
    uuid id PK
    varchar phone_number UK
    varchar display_name
    varchar public_key_hex UK
    varchar role
    timestamp created_at
  }
  MERCHANTS {
    uuid id PK
    varchar merchant_code UK
    varchar business_name
    varchar terminal_pubkey_hex UK
    varchar settlement_account_num
    bigint max_offline_ticket_kobo
    bigint max_cumulative_offline_kobo
  }
  MOCK_BANK_ACCOUNTS {
    uuid id PK
    uuid user_id FK
    varchar account_number UK
    bigint available_balance_kobo
    bigint reserved_balance_kobo
  }
  ALLOCATIONS {
    uuid id PK
    varchar oac_id UK
    uuid user_id FK
    bigint allocated_amount_kobo
    bigint spent_amount_kobo
    varchar status
    timestamp expires_at
    varchar issuer_key_version
    varchar issuer_signature_hex
  }
  TRANSACTIONS {
    uuid id PK
    varchar transaction_id UK
    varchar oac_id FK
    integer seq_no
    uuid merchant_id FK
    bigint amount_kobo
    varchar invoice_nonce
    varchar status
    varchar simulated_clearing_ref
  }
  AUDIT_LOGS {
    uuid id PK
    varchar event_type
    varchar entity_id
    varchar actor
    jsonb payload
  }
```

## Integrity rules

- `users.public_key_hex` and `users.phone_number` are unique.
- `mock_bank_accounts.user_id` is unique; each user has one mock account.
- Merchant `id` equals the owning user's `id` in application code.
- `allocations.oac_id` is unique.
- `transactions.transaction_id` is unique.
- `(transactions.oac_id, transactions.seq_no)` is unique.
- `(transactions.merchant_id, transactions.invoice_nonce)` is unique.
- OAC issuance moves funds from `available_balance_kobo` to `reserved_balance_kobo`.
- Settlement increments `allocations.spent_amount_kobo`, decrements customer reserved and credits the merchant mock account.
- Expiry marks allocation `EXPIRED` but does not refund reserved funds.
- `sim/reset` clears allocations, transactions and audit logs and reseeds balances; users and merchants remain.

## Migration note

Only `0001_initial.py` exists. The checked-in `rift_dev.db` was created with `Base.metadata.create_all()` and has no `alembic_version` table; running `alembic upgrade head` against it will try to recreate existing tables. Use a fresh database for Alembic or rely on `AUTO_CREATE_SCHEMA=true` for rehearsal.
