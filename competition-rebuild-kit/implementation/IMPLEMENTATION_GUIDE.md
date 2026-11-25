# Implementation Guide

Build in dependency order. Do not start with UI polish.

## Stage 1 — Contracts and crypto

1. Define shared TypeScript types for identity, OAC, invoice, auth payload, outbox and API responses.
2. Implement canonical serialization: sorted keys, zero whitespace, UTF-8.
3. Implement Ed25519 keygen/sign/verify with `@noble/ed25519` and `@noble/hashes`; bind `sha512Sync`.
4. Implement `deriveTransactionId` exactly: SHA-256 of concatenated `oac_id + seq_no + invoice_nonce`, first 32 hex, dashed UUID layout with `tx_` prefix.
5. Verify RFC 8032 test vector across TypeScript and Python.

## Stage 2 — Storage

1. Implement IndexedDB `rift_edge_db` version 1 with keystore, allocations, invoices, outbox and audit_history stores.
2. Implement status normalisation and atomic outbox+invoice write.
3. Implement localStorage helpers for role, preferences, mock bank state, demo issuer/core and stage shortcuts.
4. Request persistent storage on startup; treat failure as non-fatal.

## Stage 3 — Core API

1. Define Pydantic schemas mirroring `architecture/API_CONTRACTS.md`.
2. Define SQLAlchemy models mirroring `architecture/DATA_MODEL.md`.
3. Implement health, register, allocations issue/status, relay, transaction status, merchant settlements and sim reset.
4. Implement ingestion pipeline in the documented decision order.
5. Wire exception handlers for uniform error envelope.

## Stage 4 — Protocol libraries

1. Implement QR invoice JSON and auth v2 binary codec; keep v1 decode fallback.
2. Implement offline verifier with no-network guarantee and no-ms ISO reconstruction.
3. Implement typed API client with 10s timeout, headers and LAN-origin rewrite.
4. Implement outbox flush and status polling.
5. Implement batch chunking/assembly.

## Stage 5 — Engine and roles

1. Implement mode detection, registration, fallback and role identity.
2. Implement lock → sign → accept → relay → reconcile.
3. Implement demo simulated core with the same anti-replay/overspend logic.
4. Implement gateway ingest and relay.

## Stage 6 — UI

1. Build design-system primitives first: Button, Sheet, Notice, Money, Segmented, Switch, ToastProvider, AppShell.
2. Build RoleGate.
3. Build Customer shell and four tabs: Overview, RIFT, Loans, Profile.
4. Build Merchant terminal with Till/Receipts/Sync & relay.
5. Build Gateway terminal.
6. Compare against `screenshots/` after every major screen.

## Stage 7 — Verification

1. Run backend tests: 39 expected.
2. Run client tests: 86 expected plus 3 optional E2E.
3. Run bank tests: 8 expected.
4. Run `npm run build` for both frontends.
5. Capture screenshots at the reference viewports and compare.
6. Perform the smoke test in `testing/SMOKE_TESTS.md`.

## Anti-patterns

- Do not redesign while core flows are broken.
- Do not introduce a router; the reference uses state-driven screens.
- Do not add a global state library; contexts plus useState are sufficient.
- Do not change signature payloads or timestamp formatting.
- Do not assume camera works without HTTPS.
- Do not copy rehearsal source files into the competition repo.
