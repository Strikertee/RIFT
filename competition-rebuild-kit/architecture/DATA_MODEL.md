# Data Model

## Backend tables

All backend models are in `rehearsal/backend/app/models.py`; migration `alembic/versions/0001_initial.py` creates the same schema. IDs are Python-generated UUID4; timestamps are Python-side timezone-aware UTC.

### users

| Column | Type | Constraints |
| --- | --- | --- |
| id | UUID | PK, default uuid4 |
| phone_number | String(20) | NOT NULL, UNIQUE |
| display_name | String(100) | NOT NULL |
| public_key_hex | String(64) | NOT NULL, UNIQUE |
| role | String(20) | NOT NULL, default CUSTOMER; CUSTOMER/MERCHANT/ADMIN |
| created_at | DateTime tz | NOT NULL, default utcnow |
| updated_at | DateTime tz | NOT NULL, default utcnow/onupdate |

Index: `idx_users_pubkey`.

### merchants

| Column | Type | Constraints |
| --- | --- | --- |
| id | UUID | PK; application sets equal to owning user id |
| merchant_code | String(32) | NOT NULL, UNIQUE |
| business_name | String(150) | NOT NULL |
| terminal_pubkey_hex | String(64) | NOT NULL, UNIQUE |
| settlement_account_num | String(10) | NOT NULL |
| risk_tier | String(20) | NOT NULL, default STANDARD; LOW/STANDARD/HIGH |
| max_offline_ticket_kobo | BigInteger | NOT NULL, default 500000; not enforced |
| max_cumulative_offline_kobo | BigInteger | NOT NULL, default 5000000; not enforced |
| created_at | DateTime tz | NOT NULL |

### mock_bank_accounts

| Column | Type | Constraints |
| --- | --- | --- |
| id | UUID | PK |
| user_id | UUID | FK users.id, CASCADE, UNIQUE |
| account_number | String(10) | NOT NULL, UNIQUE |
| available_balance_kobo | BigInteger | NOT NULL, default 5000000, >= 0 |
| reserved_balance_kobo | BigInteger | NOT NULL, default 0, >= 0 |
| created_at / updated_at | DateTime tz | NOT NULL |

### allocations

| Column | Type | Constraints |
| --- | --- | --- |
| id | UUID | PK |
| oac_id | String(64) | NOT NULL, UNIQUE |
| user_id | UUID | FK users.id, RESTRICT |
| allocated_amount_kobo | BigInteger | NOT NULL, > 0 |
| spent_amount_kobo | BigInteger | NOT NULL, default 0, >= 0 |
| currency | String(3) | NOT NULL, default NGN |
| status | String(30) | ACTIVE/EXHAUSTED/EXPIRED/REVOKED |
| issuer_key_version | String(10) | NOT NULL, default v1 |
| issuer_signature_hex | String(128) | NOT NULL |
| issued_at / expires_at / created_at | DateTime tz | NOT NULL |

Indexes: `idx_allocations_oac_id`, `idx_allocations_user_id`.

### transactions

| Column | Type | Constraints |
| --- | --- | --- |
| id | UUID | PK |
| transaction_id | String(64) | NOT NULL, UNIQUE |
| oac_id | String(64) | FK allocations.oac_id, RESTRICT |
| seq_no | Integer | NOT NULL, > 0 |
| merchant_id | UUID | FK merchants.id, RESTRICT |
| amount_kobo | BigInteger | NOT NULL, > 0 |
| currency | String(3) | NOT NULL, default NGN |
| invoice_nonce | String(64) | NOT NULL |
| customer_pubkey_hex | String(64) | NOT NULL |
| customer_signature_hex | String(128) | NOT NULL |
| relay_node_id | String(50) | nullable |
| status | String(50) | RECEIVED, CRYPTO_VALIDATED, PROVIDER_AUTHORISED (SIMULATION), SETTLED (SIMULATED), REJECTED_INVALID_SIG, REJECTED_DUPLICATE, REJECTED_OVERSPEND, QUARANTINED_COLLISION |
| simulated_clearing_ref | String(64) | nullable |
| rejection_reason | String(255) | nullable |
| created_offline_at | DateTime tz | NOT NULL |
| ingested_at | DateTime tz | NOT NULL, default utcnow |
| settled_at | DateTime tz | nullable |

Unique: `(oac_id, seq_no)`, `(merchant_id, invoice_nonce)`. Indexes: txid, status, merchant.

### audit_logs

| Column | Type | Constraints |
| --- | --- | --- |
| id | UUID | PK |
| event_type | String(50) | NOT NULL |
| entity_id | String(64) | NOT NULL |
| actor | String(50) | NOT NULL |
| payload | JSONB on PostgreSQL, JSON on SQLite | NOT NULL |
| created_at | DateTime tz | NOT NULL |

Indexes: `idx_audit_event`, `idx_audit_created`.

Observed audit events: `USER_REGISTERED`, `OAC_ISSUED`, `SIM_RESET`, `TX_REJECTED`, `COLLISION_DETECTED`, `PROVIDER_AUTHORISED`, `TX_SETTLED`.

## Client IndexedDB (`rift_edge_db`, version 1)

| Store | Key | Indexes | Purpose |
| --- | --- | --- | --- |
| keystore | id | none | Identity, Ed25519 keys, issuer key, mock balances; bank uses ids `identity_customer`, `identity_merchant`, `identity_gateway`, `identity_merchant_b`. |
| allocations | oac_id | by_status, by_expiry | Active and historical OACs with spend/seq tracking. |
| invoices | invoice_nonce | by_timestamp, by_amount | Merchant invoices; `consumed_at` marks single use. |
| outbox | transaction_id | by_sync_status, by_timestamp | Verified receipts awaiting or completed relay. |
| audit_history | id (auto) | by_timestamp | Local activity log. |

Outbox sync statuses: `PENDING_RELAY`, `CRYPTO_VALIDATED`, `RELAYED`, `SETTLED (SIMULATED)`, `QUARANTINED_COLLISION`, `REJECTED_INVALID_SIG`, `REJECTED_OVERSPEND`, `REJECTED_DUPLICATE`, `IDEMPOTENT_REPLAY`, `FAILED`. Legacy `SETTLED (SIMULATION)` is normalised to canonical.

## localStorage keys (bank)

| Key | Purpose |
| --- | --- |
| `devions-role-v1` | Selected role |
| `devions-bank-prefs-v1` | User preferences |
| `devions-bank-state-v1` | Mock balances, transactions and RIFT activity |
| `devions-demo-issuer-v1` | Local demo issuer keypair |
| `devions-demo-core-v1` | Local simulated settlement/spend maps |
| `devions-last-auth-v1` | Last signed auth token for single-device demo |
| `devions-last-batch-v1` | Last exported batch JSON |

## Seed data

`rehearsal/backend/scripts/seed_demo_data.py` idempotently creates four demo participants by phone:

- `+2348000000001` Bayo Commuter (CUSTOMER)
- `+2348000000002` Ada Student (CUSTOMER)
- `+2348000000003` Mama Bose Provisions (MERCHANT)
- `+2348000000004` Kuto Market Kiosk (MERCHANT)

Keys are deterministic from `SHA256("rift-demo-<phone>")`; all mock accounts start at `MOCK_STARTING_BALANCE_KOBO` (default 5,000,000).
