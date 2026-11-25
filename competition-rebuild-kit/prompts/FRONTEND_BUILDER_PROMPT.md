# Frontend Builder Prompt (Builder B)

```text
You are Builder B — Frontend, UI and User Experience. You work in your own branch/worktree and must not modify backend files.

READ FIRST:
- competition-rebuild-kit/design/DESIGN_SYSTEM.md
- competition-rebuild-kit/design/UI_SCREEN_INVENTORY.md
- competition-rebuild-kit/design/RESPONSIVE_BEHAVIOUR.md
- competition-rebuild-kit/design/SCREENSHOT_INDEX.md
- competition-rebuild-kit/functionality/FEATURE_SPECIFICATIONS.md
- competition-rebuild-kit/architecture/API_CONTRACTS.md
- competition-rebuild-kit/implementation/DECISIONS_AND_GOTCHAS.md

YOU OWN:
frontend/**, frontend package/lockfiles, frontend env files, frontend tests, Vite config, PWA config.

YOU MUST NOT MODIFY:
backend/**, backend models/schemas/services/migrations, backend env files.

IMPLEMENT:
- React + TypeScript + Vite + Tailwind design system from DESIGN_SYSTEM.md.
- State-driven RoleGate and three terminals (no router library).
- Customer Overview, RIFT, Loans and Profile screens.
- Merchant Till/Receipts/Sync & relay.
- Gateway ingest/relay/ledger/node monitor.
- Protocol libraries: crypto, QR codec, verifier, API client, network flush, IndexedDB, batch codec.
- Engine with mode detection, registration, demo fallback, lock, sign, accept, relay and reconcile.
- Frontend tests targeting 8 passing in the product PWA.

CONTRACT RULES:
- Implement exactly against API_CONTRACTS.md. If backend is unavailable, use mock responses matching the contract.
- Do not invent endpoints or change field names.
- Do not use crypto.randomUUID() on non-secure origins.
- Camera must be disabled with a paste fallback on HTTP LAN origins.
- QR codes must display raw token text beneath them.
- Settlement status is exactly "SETTLED (SIMULATED)".

VISUAL RULES:
- Match screenshots at 1440x900 and 390x844 after every screen.
- Amber is RIFT only; green is primary/success.
- Use 220/240/256 QR sizes for invoice/auth/batch.
- Do not introduce a new component library or visual language.

DELIVERABLES:
- Working PWA on port 5174.
- 8 passing tests and successful npm run build.
- Screenshot comparison notes.

COMMUNICATION:
After every stage, report screens/files completed, mocks used, visual comparison result and any contract mismatch. Do not touch backend files.
```
