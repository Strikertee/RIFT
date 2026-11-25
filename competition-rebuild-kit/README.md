# Competition Rebuild Kit — RIFT / Devions Bank

This folder is the definitive technical and visual handoff for rebuilding the RIFT application during the Ogun Innovate Hackathon 2026.

## Read this first

1. Read `PROJECT_CONTEXT.md` for purpose, boundaries and sources of truth.
2. Read `architecture/ARCHITECTURE.md` and `architecture/API_CONTRACTS.md` for the system shape and contracts.
3. Read `design/DESIGN_SYSTEM.md` and `design/UI_SCREEN_INVENTORY.md`; compare with `screenshots/`.
4. **If testing live or hosting on Nobus**, read `implementation/BACKEND_AND_NOBUS_DEPLOYMENT.md` and use the templates in `scripts/deploy/`.
5. Read `playbooks/SINGLE_BUILDER_PLAYBOOK.md` or `playbooks/TWO_BUILDER_PLAYBOOK.md`.
6. For online→offline rehearsal, use `testing/ONLINE_OFFLINE_TESTING.md`.
7. Use `prompts/MASTER_REBUILD_PROMPT.md` to brief a fresh AI agent.

## Source-of-truth rule

- `01_PRODUCT_REQUIREMENTS.md` and the other numbered root specs are the authoritative requirements.
- The code in `bank/`, `rehearsal/backend/`, and `rehearsal/client/` is the reference for actual current behaviour.
- The screenshots in this kit are the reference for visual fidelity.
- Where the PRD and implementation disagree, `PRD_TRACEABILITY.md` records the discrepancy. Do not silently choose one during the rebuild.

## What exists now

- `bank/` — product PWA: Devions Bank with Customer, Merchant and Gateway roles. This is the UI that should be reproduced visually.
- `rehearsal/backend/` — FastAPI + SQLite/PostgreSQL reference core implementing health, registration, OAC issuance, relay ingestion and settlement.
- `rehearsal/client/` — smaller tested protocol reference with onboarding/PIN, customer and merchant flows. It is not the product UI.
- Root numbered Markdown files — architecture, API, database, cryptography, flows, test/demo, deployment and build-day plans.

## Critical competition constraint

The original repository rules say the preparation repo must not be copied into the competition repo. The competition-day repository should be created from scratch and rebuilt from these documents, screenshots and approved contracts. Do not copy `rehearsal/` or `bank/` source files into the competition repo; use them only as a specification reference.

## Verification performed for this kit

- Backend: `pytest -q -p no:cacheprovider` → 39 passed.
- Rehearsal client: `npm test` → 86 passed, 3 E2E skipped; `npm run build` passed.
- Bank: `npm test` → 8 tests across engine and batch codec; `npm run build` passed in the source session.
- Screenshots: 93 captured across 9 viewports, plus 6 authentication screenshots and DOM/console evidence. See `design/SCREENSHOT_INDEX.md`.

## Important warnings

- The bank app is demo-first. It falls back to a local simulated core when health/registration fails. The rehearsal client fails closed when the API is not configured. Preserve this distinction.
- Camera QR scanning requires HTTPS or localhost. On HTTP LAN origins the scanner is disabled and paste-token fallback must be used.
- All money is simulated. Settlement is `SETTLED (SIMULATED)`; never present real-money settlement.
- Several specs contradict the implementation. Read `implementation/DECISIONS_AND_GOTCHAS.md` before changing anything.
