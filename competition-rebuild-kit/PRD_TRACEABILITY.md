# PRD Traceability

Authoritative requirement document: `01_PRODUCT_REQUIREMENTS.md` (and the other numbered root specs). Reference implementation: `bank/`, `rehearsal/backend/`, `rehearsal/client/`.

Status values: **Implemented**, **Partial**, **Missing**, **Divergent**.

## Functional requirements

| Requirement | Status | Reference implementation | Notes / deviations |
| --- | --- | --- | --- |
| FR-1.1 Generate Ed25519 keypair locally at onboarding | Implemented (divergent mechanism) | `rehearsal/client/src/lib/crypto.ts:51-58`, `bank/src/rift/lib/crypto.ts` | PRD says Web Crypto PRNG; code uses `@noble/ed25519` `randomPrivateKey()`. |
| FR-1.2 Register public key with Core online | Implemented | `client/src/lib/api.ts:373-378`, `bank/src/rift/engine.ts registerLive()` | Bank registration is automatic on role selection in live mode; client requires explicit onboarding online. |
| FR-1.3 Private key stored in IndexedDB, never transmitted | Implemented | `client/src/lib/db.ts:16-39`, `bank/src/rift/lib/db.ts` | Stored as plaintext hex; IndexedDB persistence is not hardware security. |
| FR-2.1 Request OAC in kobo while online | Implemented | `client/src/screens/CustomerHome.tsx:132-204`, `bank/src/screens/Rift.tsx` | UI accepts naira and parses to kobo. Duration is hardcoded to 6 hours; no selector. |
| FR-2.2 Core verifies funds, holds balance, mints OAC | Implemented | `backend/app/routers/allocations.py:42-139` | Backend returns post-lock `available_balance_kobo` and `reserved_balance_kobo`; clients patch cached balances. |
| FR-2.3 OAC fields | Implemented (field-name deviation) | `backend/app/crypto.py oac_payload()`, `api.ts` | Code uses `issuer_key_version` / `issuer_signature_hex`, not PRD names `issuer_pubkey_version` / `issuer_signature`. |
| FR-2.4 Store active OAC and local spend ledger | Implemented | `bank/src/rift/lib/db.ts`, `client/src/lib/db.ts` | `seq_no_counter`, `spent_amount_kobo`, status and expiry are tracked locally. |
| FR-3.1 Invoice QR with merchant, amount, currency, nonce, timestamp | Implemented | `qr-codec.ts encodeInvoiceQR()` in both clients | `t:'INV'` JSON, roughly 122 bytes. |
| FR-3.2 Customer scans invoice, checks balance, confirms | Implemented | `client/src/screens/CustomerHome.tsx`, `bank/src/screens/Rift.tsx` | Bank also has demo invoice path and paste-token fallback. |
| FR-3.3 Increment seq, sign canonical payload, render Auth QR | Implemented | `crypto.ts`, `qr-codec.ts`, `engine.ts signAuthorisation()` | v2 Auth QR is 262-byte binary encoded as `R2.` + base64url (~353 chars); v1 JSON decoded but not emitted. |
| FR-3.4 Merchant verifies issuer sig, customer sig, amount, nonce, expiry | Implemented (extended) | `verify.ts`, `bank/src/rift/engine.ts acceptAuthorisation()` | Also checks deterministic transaction ID, spend bound, invoice single-use, sequence rollback and 5-minute future skew. |
| FR-3.5 Green `AUTHORISED_OFFLINE` receipt and outbox save | Implemented (UI deviation) | `client/src/screens/MerchantHome.tsx:436-541`, `bank/src/rift/MerchantApp.tsx` | Bank receipt uses `StatusPill` and stored outbox; client receipt lacks some wireframe fields such as customer name, OAC ID and "Signature Check: PASS". |
| FR-4.1 Persistent IndexedDB outbox | Implemented | Both clients `db.ts` | Stores full OAC token and sync status. |
| FR-4.2 Listen to online events and periodically flush | Implemented | `network.ts useAutoSync()` | 15s flush poll, 30s status poll; bank also auto-relays on connectivity change. |
| FR-4.3 Core idempotent ingestion with per-record results | Implemented | `backend/app/services/ingestion.py` | Idempotency keyed by `transaction_id`; `X-Idempotency-Key` header is not used. |
| FR-5.1 Core re-verifies signatures with PyNaCl | Implemented | `backend/app/crypto.py`, `services/ingestion.py` | Cross-runtime test vector pinned in backend tests. |
| FR-5.2 Anti-replay: duplicate tx ID and `(oac_id, seq_no)` | Implemented | `backend/app/models.py`, `ingestion.py` | DB unique constraints plus application checks. |
| FR-5.3 Spend must not exceed allocation | Implemented | `verify.ts`, `ingestion.py` | Client checks before signing; Core checks before settlement. |
| FR-5.4 Provider state then settled | Partial | `backend/app/services/ingestion.py:369-401` | `PROVIDER_AUTHORISED (SIMULATION)` is transient within one DB transaction; clients never observe it as a persisted status. |
| FR-5.5 Collision/overspend flags and audit anomaly | Implemented | `ingestion.py`, client status helpers | `QUARANTINED_COLLISION`, `REJECTED_OVERSPEND`, audit events `COLLISION_DETECTED`, `TX_REJECTED`. |

## Non-functional requirements

| Requirement | Target | Status | Evidence / gap |
| --- | --- | --- | --- |
| QR scan speed | <1.5s | Unverified | No timing test; acceptance checklist requires stopwatch test. |
| Payload size | <400 bytes | Implemented and tested | v2 Auth QR ~353 chars; `qr-codec.test.ts` asserts <400. |
| Local verification latency | <150ms | Unverified | No timing assertion in `verify.test.ts`. |
| IndexedDB durability | Zero loss across restarts | Partially evidenced | Atomic writes and E2E in-session persistence; no browser-kill test. |
| Backend ingestion throughput | >100 tx/s | Unverified | No benchmark in repo. |
| PWA cold startup | <2.0s | Unverified | Service worker configured; no measured startup test. |

## Additional features not in the PRD

- Local PIN onboarding/login in `rehearsal/client` (PBKDF2-HMAC-SHA256, 210,000 iterations).
- Gateway terminal and optical batch QR chunking in `bank`.
- Paste-token fallback and raw QR token text for non-HTTPS two-device transfer.
- Demo-first local simulated core and sticky fallback in `bank`.
- Mock banking UI: send money, receive, bill payments, loans, analytics, profile settings.
- `POST /api/v1/sim/reset` rehearsal reset endpoint.

## Missing or incomplete PRD features

- Exact wireframe details: customer history screen, validity dropdown, bottom nav in reference client, printed receipt, exact simulation footer text.
- Manual verification token contingency from test plan is not implemented in the reference client; bank paste token is the closest equivalent.
- Merchant risk thresholds (`max_offline_ticket_kobo`, `max_cumulative_offline_kobo`) exist as columns but are not enforced.
- Full RFC 8785 JCS is approximated by sorted-key `JSON.stringify` / `json.dumps`; current string/integer payloads are compatible.
- Nobus deployment stack is proposed only: no `docker-compose.yml`, `Caddyfile` or frontend Dockerfile in the repository.

## Major discrepancies to preserve or resolve explicitly

1. Status strings vary across specs: `PROVIDER_AUTHORISED (SIMULATION)` vs `(SIMULATED)`, `SETTLED_SIMULATION` vs `SETTLED (SIMULATED)`, `RELAY_PENDING` vs `PENDING_RELAY`. Implementation uses `SETTLED (SIMULATED)` and `PENDING_RELAY`.
2. `03_API_CONTRACTS.md` requires `X-Idempotency-Key` and `X-RIFT-Client-Version`; backend ignores both.
3. `03_API_CONTRACTS.md` shows admin secret `rift-secret-hackathon-2026`; backend default is `rift-hackathon-ogun-2026`. Do not hardcode either in competition code; generate a new secret.
4. Transaction ID spec is inconsistent: integration notes say colons are included; code and backend use no separators and dashed UUID layout.
5. QR target sizes differ: <400, ≤380 and <450 appear in different docs. v2 QR is ~353 chars.
6. `04_DATABASE_SCHEMA.md` references `MOCK_BANK_TRANSFERS`; no such table exists in code.
7. Preparation repo rules forbid application code in Tier A, but this workspace contains full source in `bank/` and `rehearsal/`.
8. Bank demo mode conflicts with the integration note that clients should not self-sign OACs; treat bank as product demo, not authoritative client.
