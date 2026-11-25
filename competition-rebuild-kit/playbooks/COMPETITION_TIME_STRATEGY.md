# Competition Time Strategy

## Priority matrix

### P0 — Essential

- Role gate and three terminals.
- Customer lock → sign → Auth QR.
- Merchant invoice → offline verify → outbox.
- Gateway/merchant relay to Core or simulated core.
- Deterministic transaction ID, Ed25519 signatures, canonical JSON.
- Anti-replay and overspend checks.
- `SETTLED (SIMULATED)` status and clearing reference.
- Design tokens and core layout from screenshots.
- Startup instructions that work from clean clone.

### P1 — Important

- Live registration and demo fallback.
- Allocation status reconciliation.
- Batch QR export/import.
- Paste-token fallback and raw QR token.
- Receipt filters, settlement ledger, node monitor.
- Backend test suite and frontend engine tests.
- PWA service worker and installability.

### P2 — Nice to have

- Loans calculator and schedule sheets.
- Send/receive/bill-payment mock sheets.
- Charts and donut animation.
- Profile/help/about sheets.
- Theme toggle and sound preferences.
- Nobus deployment stack.

## Time allocation

### First 10% — foundation

- Read PRD and kit; create repo skeleton.
- Implement types, canonical serialization and crypto vector.
- Set up env templates and dev servers.
- Never skip the crypto vector.

### Next 20% — core

- Implement storage, Core API and ingestion.
- Prove health, register, issue and relay with tests.
- If backend is late, Builder B uses contract mocks.

### Next 40% — main product

- Implement protocol libraries and engine.
- Implement design system, RoleGate, Customer RIFT and Merchant Till.
- Wire golden demo loop end to end.
- This is the critical path; do not polish secondary screens here.

### Next 20% — integration and secondary UI

- Gateway terminal, batch QR, reconciliation.
- Mock banking screens and preferences.
- Run all tests and builds.

### Final 10% — freeze and submit

- Visual comparison against screenshots.
- Smoke tests and three consecutive demo runs.
- Write clean README and confirm startup.
- Freeze commit/tag.

## Parallel vs sequential

- Parallel: frontend design system and backend schemas can start together.
- Sequential: API client depends on agreed contract; engine depends on protocol libs; UI depends on engine.
- Do not parallelize crypto implementation across builders; one module must own it.

## What can be simplified

- Charts can become static cards.
- Loans can be a single calculator card.
- Mock banking sheets can be reduced to one send and one receive sheet.
- Deployment can remain local if Nobus access is unavailable.

## What must never be skipped

- Signature verification.
- Deterministic transaction IDs.
- Anti-replay and overspend checks.
- Local vs settled distinction.
- Demo fallback or clear failure behaviour.
- Final smoke tests.

## Failing build

1. Stop feature work.
2. Run typecheck/build and read first error.
3. Revert the last verified stage if the error is not understood in 10 minutes.
4. Commit only green states.

## External API unavailable

- Bank uses demo mode; show the fallback notice.
- Rehearsal-style client must show a clear API-not-configured error.
- Do not fake live settlement; simulated core is acceptable and labelled.

## Avoiding UI-polish trap

Set a timer. Do not touch spacing, shadows or animation until the golden demo loop passes. Use screenshots only to guide structural decisions during the critical path.
