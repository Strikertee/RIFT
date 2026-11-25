# Project Context

## What the project does

RIFT (Resilient Infrastructure for Financial Transactions) is a hackathon prototype for offline-first, cryptographically attested payments. A customer locks funds while online into an issuer-signed Offline Allocation Certificate (OAC), then signs payment authorisations offline using Ed25519. A merchant verifies those authorisations locally and stores them in an IndexedDB outbox. A gateway relays queued batches back to RIFT Core, which re-verifies signatures, enforces anti-replay and overspend rules, and records simulated settlement.

The product UI is Devions Bank, a mobile-first mock banking PWA with three terminals: Customer, Merchant and Gateway.

## Why it exists

Network failures in Nigerian markets and transit hubs cause abandoned digital payments. RIFT demonstrates how authenticated payment instructions can be exchanged over QR codes with no connectivity, then settled asynchronously when connectivity returns. It is deliberately honest: offline receipts are authorisations, not settlement; there is no real money movement.

## Repository triad

| Tier | Location | Purpose | Code policy |
| --- | --- | --- | --- |
| A — Preparation | repository root Markdown specs | Requirements, architecture, contracts, playbooks | Specifications only |
| B — Rehearsal sandbox | `rehearsal/` | Disposable tested implementations | Do not copy to competition repo |
| C — Competition | fresh `git init` on event day | Rebuild from documentation | Clean history, no rehearsal code copied |

The current workspace contains B and a product prototype inside A; this is a deviation from the written triad and is documented in `PRD_TRACEABILITY.md`.

## Core requirements

1. Air-gap completeness after an OAC exists.
2. Self-contained QR payloads with all claims and signatures.
3. Clear separation between local authorisation and authoritative settlement.
4. Deterministic canonical JSON for signatures across TypeScript and Python.
5. Simulated financial core only.

## Current applications

### bank/ (product UI)

- React 18 + TypeScript + Vite 6 + Tailwind 3 + PWA plugin.
- Three roles selected from `RoleGate`; no router library.
- Demo-first: local issuer and simulated core when backend health/registration fails.
- Live mode: registers customer/merchant with FastAPI Core and issues real backend OACs.
- Customer screens: Overview, RIFT, Loans, Profile.
- Merchant terminal: Till, Receipts, Sync & relay.
- Gateway terminal: ingest batch QR/paste, relay queue, settlement ledger.

### rehearsal/backend/ (reference core)

- FastAPI, SQLAlchemy 2.0 async, Alembic, Pydantic v2, PyNaCl.
- Default SQLite `rift_dev.db`; production target PostgreSQL 15.
- Endpoints: health, register, allocations issue/status, relay, transaction status, merchant settlements, sim reset.
- 39 passing tests.

### rehearsal/client/ (protocol reference)

- React 18 + TypeScript + Vite 6 PWA.
- Onboarding, local PIN login, customer home, merchant home.
- No gateway role; requires configured backend; no demo fallback.
- 86 unit tests plus 3 optional live E2E tests.

## Core invariants

- Money is integer kobo.
- `transaction_id = tx_` + first 32 hex chars of `SHA256(oac_id || seq_no || invoice_nonce)`, formatted as 8-4-4-4-12.
- OAC and transaction canonical payloads use sorted keys and zero whitespace.
- Timestamps in API payloads use `YYYY-MM-DDTHH:MM:SSZ` with no fractional seconds.
- `SETTLED (SIMULATED)` is the canonical settled status; `SETTLED (SIMULATION)` is a legacy alias only.
- `(oac_id, seq_no)` and `(merchant_id, invoice_nonce)` are unique in Core.
- Private keys stay on device; the bearer token is an account ID, not a secret, in this rehearsal.

## Known limitations

- Offline double-spend cannot be prevented without trusted hardware; Core detects conflicts on relay.
- Camera scanning requires HTTPS or localhost; HTTP LAN origins disable camera and require paste fallback.
- Bank demo mode uses a localStorage simulated core and local issuer; this differs from the rehearsal client's fail-closed model.
- Several UI elements are mock: send money, bill payments, loans, analytics charts, profile data.
- `Reset demo data` in the bank UI does not clear all IndexedDB protocol state.

## Rebuild priority

MVP must preserve: role gate, customer lock/sign, merchant invoice/verify, gateway relay, local verification, Core relay ingestion, anti-replay, simulated settlement, and the visual design system. Secondary UI such as loans and charts can be simplified after the core loop works.
