# Single-Builder Playbook

One agent/developer builds everything. Use this when working alone or with one AI agent.

## Recommended order

1. **Read inputs:** PRD, `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `API_CONTRACTS.md`, `DESIGN_SYSTEM.md`, `SCREENSHOT_INDEX.md`.
2. **Create skeleton:** repository, frontend app, backend app, env templates, folders from `FILE_STRUCTURE.md`.
3. **Contracts first:** types, Pydantic schemas, canonical serialization, crypto test vector.
4. **Storage:** IndexedDB stores and localStorage keys.
5. **Core API:** health, register, allocations issue/status, relay, transaction status, settlements, sim reset.
6. **Ingestion:** verification order, anti-replay, ledger settlement, audit logs.
7. **Protocol libs:** QR codecs, verifier, API client, network flush, batch codec.
8. **Engine:** mode detection, registration, lock, sign, accept, relay, reconcile.
9. **UI shell:** design tokens, Button/Sheet/Notice/Money/Toast, AppShell, RoleGate.
10. **Customer UI:** Overview, RIFT, Loans, Profile.
11. **Merchant UI:** Till, Receipts, Sync & relay.
12. **Gateway UI:** ingest, relay queue, ledger.
13. **Tests and visual comparison.**

## Dependency map

- Crypto ← storage ← API client ← engine ← UI.
- Backend schemas ← routers ← ingestion ← tests.
- Design system ← all screens.
- RoleGate depends only on shell and mode state; build it early for visual confidence.

## Avoid repeated architecture changes

- Decide the module boundaries once from `FILE_STRUCTURE.md`.
- Keep all protocol math in `lib/crypto.ts` and `app/crypto.py`; do not scatter it across screens.
- Keep all API calls in one typed client.
- Keep all IndexedDB access in one db module.
- Keep UI state in contexts/useState exactly as reference.

## Maintaining consistent UI

- Implement `index.css` variables and Tailwind config before screens.
- Build shared `ui.tsx` primitives once.
- After each screen, open the corresponding screenshot at 1440x900 and 390x844.
- Do not add new visual languages; amber is RIFT only, green is primary/success.

## Testing each stage

| Stage | Minimum verification |
| --- | --- |
| Crypto | RFC 8032 vector and transaction ID test |
| Storage | Save/read allocation, invoice, outbox and status normalisation |
| Core | Health and registration via curl/httpx; backend tests |
| Ingestion | Valid settlement, idempotent replay, collision, overspend |
| Protocol | Invoice QR round trip, auth QR round trip, offline verifier |
| Engine | Demo lock→sign→accept→relay |
| UI | Screenshot comparison at desktop and mobile |

## Preventing context loss

- Keep this kit open; do not rely on chat history.
- Update a local progress file after each stage with completed items and next action.
- Commit after each verified stage with names like `feat(core): add relay ingestion`.
- When a fresh agent takes over, give it `MASTER_REBUILD_PROMPT.md` plus the progress file.

## Time management

- First 10%: setup, contracts, crypto.
- Next 20%: storage, core API, ingestion.
- Next 40%: protocol libs, engine and main UI.
- Next 20%: feature integration, secondary UI, tests.
- Final 10%: visual comparison, smoke tests, submission.

## Completion criteria

- Golden demo loop works in demo mode with no backend.
- Golden demo loop works in live mode with backend running.
- Relay rejection statuses surface in UI.
- All screenshots have visually comparable counterparts.
- Tests and builds pass.
- README startup instructions work from a clean clone.
