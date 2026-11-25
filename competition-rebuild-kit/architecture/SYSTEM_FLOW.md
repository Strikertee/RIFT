# System Flow

## 1. Online allocation pre-funding

1. User selects Customer role; `ensureRoleIdentity('customer')` runs.
2. If live mode: `registerLive()` POSTs to `/api/v1/auth/register`; on collision it rotates keypair, phone and merchant code and retries once.
3. `lockFunds(kobo)` calls `POST /api/v1/allocations/issue` with `duration_hours: 6`.
4. Core checks role, ownership, mock account balance, moves funds from available to reserved, signs the canonical OAC, stores allocation and returns post-lock balances.
5. Client stores OAC in IndexedDB, patches cached balances and shows the allocation certificate.
6. If health/registration fails, `forceDemoMode()` switches to a local issuer and simulated core.

## 2. Offline proximity payment

1. Merchant creates an invoice: `t:'INV'`, `m`, `a`, `c`, `n`, `ts`; renders QR and raw token.
2. Customer scans invoice or uses demo invoice; checks amount against remaining allocation.
3. Customer increments `seq_no`, builds canonical transaction payload, signs with Ed25519, derives `transaction_id`, embeds full OAC fields, renders v2 Auth QR and raw token.
4. Merchant scans or pastes token; `acceptAuthorisation()` decodes QR.
5. Offline verification reconstructs the canonical OAC with no-millisecond ISO dates, verifies issuer signature, checks expiry, merchant, amount and nonce, derives transaction ID, verifies customer signature and sequence.
6. On success the merchant saves an outbox entry with `sync_status: 'PENDING_RELAY'`, marks the invoice consumed and shows a green receipt.

## 3. Store-and-forward relay

1. A merchant or gateway connects to the internet.
2. `relayBatch(nodeId, onlyIds?)` selects pending entries in OAC sequence order.
3. Live path builds `POST /api/v1/transactions/relay` payload with full `oac_token` and optional `X-Relay-Api-Key`.
4. Core processes each transaction in its own DB transaction and returns `results[]` with per-record status.
5. Client persists each result into the outbox using `updateOutboxSyncResult()`.
6. Demo path re-verifies locally and applies the simulated ledger in localStorage; settled status is `SETTLED (SIMULATED)`.

## 4. Gateway optical batch transfer

1. Merchant exports pending outbox as JSON.
2. `batch-codec.ts` splits it into `RB.<total>.<index>.<payload>` chunks of 450 characters.
3. Merchant displays numbered QR codes with Previous/Next controls.
4. Gateway scans in any order; `GatewayApp.handleToken()` accumulates chunks and auto-ingests when all are present.
5. `ingestBatch()` skips malformed entries and duplicate transaction IDs, stores the rest as pending.

## 5. Core ingestion decision order

1. Existing `transaction_id` → `IDEMPOTENT_REPLAY`.
2. Recomputed deterministic ID mismatch → `REJECTED_INVALID_SIG` / `TRANSACTION_ID_MISMATCH`.
3. OAC token ID or customer pubkey mismatch → `REJECTED_INVALID_SIG`.
4. Timestamp parse or OAC timestamp invalid → `INVALID_OAC_TIMESTAMP`.
5. Unknown OAC or merchant → `REJECTED_INVALID_SIG`.
6. Issuer signature invalid or key version mismatch → `INVALID_ISSUER_OAC_SIGNATURE`.
7. Customer signature invalid → `INVALID_CUSTOMER_SIGNATURE`.
8. OAC customer/amount/status/expiry checks → expired or `REJECTED_OVERSPEND`.
9. `(oac_id, seq_no)` collision → `QUARANTINED_COLLISION`.
10. `(merchant_id, invoice_nonce)` collision → `REJECTED_DUPLICATE`.
11. Overspend → `REJECTED_OVERSPEND`.
12. Ledger reserve consistency → `LEDGER_INCONSISTENT` / `RESERVE_UNDERFLOW`.
13. Settlement: insert `CRYPTO_VALIDATED`, increment allocation spend, decrement customer reserved, credit merchant, audit `PROVIDER_AUTHORISED`, then set `SETTLED (SIMULATED)`.

## 6. Reconciliation

- Customer can reconcile an OAC: live `GET /allocations/{oac_id}` or demo local spent map.
- Client reconciliation only raises local spend counter; it never decreases it.
- Transaction status polling updates outbox rows without changing settled state back.

## Failure handling

- Network failure during live registration → sticky demo fallback.
- Relay rejection stays in `results[]`; HTTP status is still 200.
- Missing issuer key in live mode → health reports degraded and bank uses demo.
- Camera unavailable → paste token fallback.
- Browser reload recovers state from IndexedDB/localStorage.
