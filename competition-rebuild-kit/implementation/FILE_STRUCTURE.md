# File Structure

## Repository root

| Path | Responsibility |
| --- | --- |
| `00_MASTER_BUILD_PLAN.md` | Build phases, gates, 24-hour schedule and decision register |
| `01_PRODUCT_REQUIREMENTS.md` | Authoritative PRD |
| `02_SYSTEM_ARCHITECTURE.md` | Topology, data flow, trust boundaries |
| `03_API_CONTRACTS.md` | Endpoint contracts and error schema |
| `04_DATABASE_SCHEMA.md` | PostgreSQL and IndexedDB schema specification |
| `05_CRYPTOGRAPHY_PROTOCOL.md` | Canonical payloads, QR v2 layout, verification algorithm |
| `06_USER_FLOWS_AND_WIREFRAMES.md` | Wireframes and flow expectations |
| `07_TEST_AND_DEMO_PLAN.md` | Test tiers and demo choreography |
| `08_AGENT_OPERATING_MANUAL.md` | AI agent guardrails |
| `09_NOBUS_DEPLOYMENT_CHECKLIST.md` | Proposed deployment topology |
| `10_TEAM_ROLES_AND_BUILD_DAY_PLAN.md` | Team ownership and hourly plan |
| `11_TECHNICAL_REHEARSAL_PLAN.md` | Disposable spike experiments |
| `12_OPEN_DECISIONS_AND_RISKS.md` | ADRs and risk register |
| `13_BUILD_DAY_ACCEPTANCE_CHECKLIST.md` | Go/no-go gates |
| `README.md` | Repository overview and documentation index |
| `bank/` | Product PWA reference |
| `rehearsal/backend/` | FastAPI reference core |
| `rehearsal/client/` | Protocol reference PWA |
| `competition-rebuild-kit/` | This handoff package |

## bank/

| Path | Responsibility |
| --- | --- |
| `src/main.tsx` | Entry point, provider tree, service worker registration |
| `src/App.tsx` | Role-driven screen switch and Customer tab state |
| `src/types.ts` | Tab union |
| `src/context/BankContext.tsx` | Mock balances, transactions and RIFT activity in localStorage |
| `src/context/PrefsContext.tsx` | Theme, sound, hide-balance, notifications, app lock |
| `src/components/AppShell.tsx` | Logo, wordmark, network pill, background, header, sidebar |
| `src/components/BottomNav.tsx` | Mobile dock |
| `src/components/ui.tsx` | Buttons, sheets, fields, notices, toasts, money, switches |
| `src/components/charts.tsx` | Cash flow chart, donut, ring |
| `src/data/mock.ts` | Seeded mock banking data |
| `src/screens/Home.tsx` | Customer overview and send/receive/history/service sheets |
| `src/screens/Rift.tsx` | Customer lock, spend, QR and reconcile |
| `src/screens/Loan.tsx` | Mock loan calculator and schedule |
| `src/screens/Me.tsx` | Profile, preferences and help/about/reset sheets |
| `src/rift/RoleGate.tsx` | Three-terminal chooser |
| `src/rift/RoleContext.tsx` | Role/mode/ready state |
| `src/rift/engine.ts` | RIFT orchestration for all roles |
| `src/rift/MerchantApp.tsx` | Merchant terminal |
| `src/rift/GatewayApp.tsx` | Gateway terminal |
| `src/rift/Scanner.tsx` | html5-qrcode scanner and secure-context guard |
| `src/rift/lib/crypto.ts` | Ed25519 and canonicalization |
| `src/rift/lib/qr-codec.ts` | Invoice/auth QR codecs |
| `src/rift/lib/verify.ts` | Offline verifier |
| `src/rift/lib/db.ts` | IndexedDB schema and helpers |
| `src/rift/lib/api.ts` | REST client |
| `src/rift/lib/network.ts` | Outbox flush and polling |
| `src/rift/lib/batch-codec.ts` | Batch QR chunking |
| `src/rift/lib/reconcile.ts`, `balance.ts`, `format.ts`, `credentials.ts` | Supporting helpers |
| `src/__tests__/` | Vitest engine and batch-codec tests |
| `src/index.css`, `tailwind.config.js` | Design system |
| `vite.config.ts` | Dev proxy, PWA plugin, tunnel host |

## rehearsal/backend/

| Path | Responsibility |
| --- | --- |
| `app/main.py` | FastAPI app, CORS, exception handlers, root route |
| `app/config.py` | Settings from environment |
| `app/models.py` | SQLAlchemy models |
| `app/schemas.py` | Pydantic request/response schemas |
| `app/crypto.py` | Canonicalization, issuer key, signatures, transaction ID |
| `app/db.py` | Async engine and startup schema creation |
| `app/deps.py` | Bearer/relay/admin authentication dependencies |
| `app/errors.py` | ApiError and handlers |
| `app/routers/` | health, auth, allocations, transactions, merchants, sim |
| `app/services/ingestion.py` | Verification, anti-replay, settlement pipeline |
| `app/services/ledger.py` | Account numbers, merchant codes, clearing refs, audit logs |
| `alembic/versions/0001_initial.py` | Initial migration |
| `scripts/seed_demo_data.py` | Demo participants |
| `tests/` | 39 pytest tests |

## rehearsal/client/

| Path | Responsibility |
| --- | --- |
| `src/App.tsx` | Startup routing, registration, PIN, issuer fetch |
| `src/screens/Onboarding.tsx` | Role and profile onboarding |
| `src/screens/SetPin.tsx`, `Login.tsx` | Device-local PIN |
| `src/screens/CustomerHome.tsx` | Allocate, scan, confirm, Auth QR, vault |
| `src/screens/MerchantHome.tsx` | Invoice, verify, receipt, outbox/settlement |
| `src/lib/*` | Protocol libraries mirroring bank |
| `src/__tests__/` | 89 test declarations, 3 optional E2E |

## competition-rebuild-kit/

See root `README.md` and `manifests/FILE_INVENTORY.md`.
