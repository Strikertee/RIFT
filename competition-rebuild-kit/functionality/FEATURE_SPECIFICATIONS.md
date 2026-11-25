# Feature Specifications

## Role selection and mode detection

**Purpose:** Let one PWA act as Customer, Merchant or Gateway and show whether it is using RIFT Core or the simulated core.

**User flow:** Open app → choose terminal → app ensures identity → terminal loads.

**Frontend behaviour:** `RoleGate` shows three cards, mode badge and disclaimer; `RoleContext` persists role and listens for `rift-mode-change`.

**Backend behaviour:** `GET /api/v1/health` probe; customer/merchant registration in live mode.

**API calls:** GET /health, POST /auth/register.

**Database operations:** IndexedDB keystore identity upsert.

**Validation:** Live iff `issuer_key_loaded === true`; 15s cache; 2.5s timeout.

**Success:** Terminal renders with ready identity and correct mode badge.

**Failure:** Registration/network failure forces sticky demo and shows notice.

**Dependencies:** API client, crypto keygen, IndexedDB.

**Implementation references:** `bank/src/rift/RoleGate.tsx`, `RoleContext.tsx`, `engine.ts detectMode/registerLive/ensureRoleIdentity`.

**Testing:** Switch role; block health; confirm demo badge and no console errors.

## Customer lock funds

**Purpose:** Reserve mock funds and mint an OAC for offline spending.

**User flow:** Customer → RIFT → enter/select amount → Lock funds → view certificate.

**Frontend behaviour:** Amount input, quick chips, cap/available validation, busy state, allocation card, activity entry.

**Backend behaviour:** Live path issues allocation; demo path signs local OAC and updates localStorage demo issuer/core.

**API calls:** POST /allocations/issue.

**Database operations:** Insert allocation; update mock_account available/reserved; audit `OAC_ISSUED`. Demo writes localStorage.

**Validation:** Amount >0, integer kobo, ≤ remaining cap (₦50,000 total), ≤ available, `duration_hours: 6`.

**Success:** OAC stored, offline balance shown, post-lock balances patched.

**Failure:** Insufficient funds → error notice; live failure → demo fallback notice.

**Dependencies:** Identity, issuer key, IndexedDB, BankContext.

**Implementation references:** `bank/src/screens/Rift.tsx handleLock`, `engine.ts lockFunds`, `backend/app/routers/allocations.py`.

**Testing:** Lock ₦10,000; assert allocation card and `READY`; backend test asserts balances 4,900,000 / 100,000 from 5,000,000.

## Customer sign authorisation

**Purpose:** Convert a merchant invoice into a signed offline authorisation QR.

**User flow:** Spend offline via QR → demo invoice or scan → amount check → Sign payment token → show QR/raw token → Done.

**Frontend behaviour:** Sheet steps `form|qr|done`; QRCodeSVG size 240; raw token text; polls outbox to auto-advance when accepted.

**Backend behaviour:** None while offline.

**API calls:** None.

**Database operations:** Update allocation `seq_no_counter` and `spent_amount_kobo`; store last auth in localStorage for stage mode.

**Validation:** Invoice amount ≤ remaining allocation; active non-expired OAC; integer amounts.

**Success:** Compact v2 Auth QR, deterministic `transaction_id`, Ed25519 signature.

**Failure:** Over-allocation throws "Invoice exceeds your remaining offline allocation"; malformed QR shows error.

**Dependencies:** OAC, keypair, qr-codec, crypto.

**Implementation references:** `bank/src/screens/Rift.tsx doSign`, `engine.ts signAuthorisation`, `lib/qr-codec.ts`, `lib/verify.ts`.

**Testing:** Demo lock → sign → decode QR → decode tx matches derived ID.

## Merchant invoice and accept

**Purpose:** Generate an invoice and locally verify a customer authorisation.

**User flow:** Merchant → Till → enter amount → Create invoice QR → customer signs → scan or paste auth → success receipt.

**Frontend behaviour:** Keypad, typed amount input, QR, copy token, Scanner, "Pull demo token" shortcut, status pill receipt.

**Backend behaviour:** None during local verification.

**API calls:** None.

**Database operations:** Insert outbox entry with full OAC token and `PENDING_RELAY`; mark invoice consumed; local audit.

**Validation:** Merchant ID, amount and nonce match invoice; issuer signature; customer signature; expiry; sequence rollback; transaction ID; spend bound.

**Success:** Green receipt and outbox row.

**Failure:** Rejection reason shown as lowercase human text; error toast; playError sound.

**Dependencies:** Issuer pubkey, verification engine, IndexedDB.

**Implementation references:** `bank/src/rift/MerchantApp.tsx handleAccept`, `engine.ts acceptAuthorisation`.

**Testing:** Bank engine test lock→accept→relay settles 1; client verify tests cover tamper cases.

## Gateway batch ingest and relay

**Purpose:** Move offline receipts from merchants to Core via optical batch or local outbox.

**User flow:** Gateway → ingest chunk QRs/paste JSON → review queue → Relay all → inspect ledger.

**Frontend behaviour:** Scanner, chunk progress, per-row SIG pill, relay buttons, settlement ledger and node monitor.

**Backend behaviour:** Live relay ingestion; demo simulated settlement.

**API calls:** POST /transactions/relay.

**Database operations:** Insert pending outbox entries; update statuses from relay results.

**Validation:** Batch chunks require all indices; entry needs transaction_id, oac_token and customer signature to ingest; relay performs full verification.

**Success:** Settled statuses in ledger; clearing reference.

**Failure:** Invalid entries can sit in queue with SIG invalid; relay marks rejected/quarantined; HTTP 200 with per-record results.

**Dependencies:** batch-codec, outbox, Scanner, Core.

**Implementation references:** `bank/src/rift/GatewayApp.tsx`, `engine.ts ingestBatch/relayBatch`, `lib/batch-codec.ts`.

**Testing:** Batch codec round-trip test; gateway browser capture; backend ingestion tests.

## Live registration and fallback

**Purpose:** Bind device keys to Core accounts when online, without blocking demo use.

**User flow:** Role selected in live mode → register automatically → on conflict rotate identity → continue; on failure switch to demo.

**Frontend behaviour:** Mode badge, notice toast, hidden to user unless failure.

**Backend behaviour:** POST /auth/register; duplicate checks.

**API calls:** POST /auth/register.

**Database operations:** Insert user, mock account and merchant row if applicable.

**Validation:** 64-hex public key, phone 6–20, display name 2–100; unique phone/key/merchant code.

**Success:** `backend_user_id` stored in keystore; live badge.

**Failure:** Network/5xx/USER_NOT_FOUND/UNAUTHORIZED → sticky demo.

**Dependencies:** API client, crypto, IndexedDB.

**Implementation references:** `engine.ts registerLive`, `shouldFallbackToDemo`, `api.ts register`.

**Testing:** Bank live test mocks health/register/issue and asserts live mode.

## Reconciliation

**Purpose:** Refresh OAC spend and balances from Core or demo core.

**User flow:** Customer RIFT → Reconcile.

**Frontend behaviour:** Button on allocation card; updated remaining balance/activity.

**Backend behaviour:** GET /allocations/{oac_id} in live mode.

**API calls:** GET /allocations/{oac_id}.

**Database operations:** Local `recordAllocationReconciliation` only raises spend counter; may mark EXHAUSTED.

**Validation:** OAC must exist and be owned.

**Success:** Local spend catches up to server.

**Failure:** Errors shown in notice; local state never decreases.

**Implementation references:** `Rift.tsx handleReconcile`, `engine.ts reconcileCustomer`, `lib/reconcile.ts`.

## Mock banking UI

**Purpose:** Provide realistic banking surface around RIFT.

**Features:** Send money sheet with form/confirm/processing/done; Receive with copy/share; cash-flow and spending charts; bill payment sheets; loan calculator and schedule; profile/preferences/help/about/reset.

**Backend behaviour:** None; all local constants and localStorage.

**Validation:** Send requires recipient and amount; service payments require reference and amount.

**Success:** Local balance changes, demo toast/reference.

**Failure:** Inline validation notices.

**Implementation references:** `bank/src/screens/Home.tsx`, `Loan.tsx`, `Me.tsx`, `data/mock.ts`, `context/BankContext.tsx`.

**Warning:** These are mock and must not be described as real integrations.
