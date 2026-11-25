# Master Rebuild Prompt

Paste this into a fresh AI coding agent at the start of the competition rebuild.

```text
You are rebuilding the RIFT / Devions Bank application from a documentation handoff. You have no access to the original conversation or memory.

FIRST, READ THESE FILES IN ORDER:
1. competition-rebuild-kit/README.md
2. competition-rebuild-kit/PROJECT_CONTEXT.md
3. ../01_PRODUCT_REQUIREMENTS.md (original PRD; authoritative)
4. competition-rebuild-kit/PRD_TRACEABILITY.md
5. competition-rebuild-kit/architecture/ARCHITECTURE.md
6. competition-rebuild-kit/architecture/API_CONTRACTS.md
7. competition-rebuild-kit/architecture/DATA_MODEL.md
8. competition-rebuild-kit/design/DESIGN_SYSTEM.md
9. competition-rebuild-kit/design/UI_SCREEN_INVENTORY.md
10. competition-rebuild-kit/design/SCREENSHOT_INDEX.md
11. competition-rebuild-kit/implementation/IMPLEMENTATION_GUIDE.md
12. competition-rebuild-kit/playbooks/COMPETITION_TIME_STRATEGY.md
13. competition-rebuild-kit/AGENT_EXECUTION_MEMORY.md

WHAT THE APPLICATION IS:
A demo-first offline payment protocol with three PWA terminals (Customer, Merchant, Gateway) and a FastAPI core. Customers lock funds into an Ed25519-signed OAC, sign offline payment authorisations, merchants verify locally and queue receipts, gateways relay batches to Core for anti-replay, overspend checks and SIMULATED settlement. The UI must look like the captured Devions Bank screenshots.

BUILD ORDER:
Follow implementation/IMPLEMENTATION_GUIDE.md exactly: contracts and crypto, storage, Core API, ingestion, protocol libraries, engine, UI shell, screens, tests, visual comparison.

NON-NEGOTIABLE RULES:
- Do not copy source files from the preparation repository into the competition repository. Rebuild from docs and screenshots.
- Do not redesign the UI. Reuse DESIGN_SYSTEM.md and match SCREENSHOT_INDEX.md.
- Do not change canonical serialization, timestamp formatting, transaction ID derivation or status strings.
- Do not use Date.toISOString() for OAC timestamps; it adds milliseconds and breaks signatures.
- Do not use crypto.randomUUID() on HTTP LAN origins; use crypto.getRandomValues().
- Do not assume camera works without HTTPS; preserve paste-token fallback.
- Do not present simulated settlement as real money movement.
- Do not claim a feature is complete until its test/build command passes.
- Commit after each verified stage with concise conventional messages.

MVP DEFINITION:
The golden demo loop must work in demo mode with no backend: lock, sign, merchant verify, relay, simulated settlement. It should also work in live mode with the FastAPI backend running. Preserve the distinction: bank demo mode falls back to a local simulated core; a strict client fails closed without a backend.

VERIFICATION REQUIRED:
- Backend tests: 39 passing.
- Rehearsal client tests: 86 passing, 3 optional E2E skipped unless configured.
- Bank tests: 8 passing.
- npm run build for both frontends.
- Screenshot comparison at 1440x900 and 390x844.
- Smoke test from testing/SMOKE_TESTS.md.

WORKFLOW:
1. State your implementation plan before writing code.
2. Build in dependency order.
3. After each stage, report files created, commands run, results, and next stage.
4. Update a progress file so a fresh agent can continue.
5. If blocked, report the exact blocker and use the documented fallback; do not invent a new architecture.

Begin by summarizing the architecture, build order and risks in your own words. Then start Stage 1.
```
