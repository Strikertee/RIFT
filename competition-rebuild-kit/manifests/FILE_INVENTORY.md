# File Inventory

## competition-rebuild-kit

| Path | Purpose | Status |
| --- | --- | --- |
| `README.md` | Kit entry point and source-of-truth rules | Complete |
| `PROJECT_CONTEXT.md` | Project purpose, apps, invariants, limitations | Complete |
| `PRD_TRACEABILITY.md` | FR/NFR mapping and discrepancies | Complete |
| `AGENT_EXECUTION_MEMORY.md` | Factual development/action record | Complete |
| `architecture/ARCHITECTURE.md` | Component topology and state ownership | Complete |
| `architecture/SYSTEM_FLOW.md` | End-to-end flows and ingestion order | Complete |
| `architecture/DATA_MODEL.md` | Backend and client storage model | Complete |
| `architecture/API_CONTRACTS.md` | Endpoint contracts | Complete |
| `architecture/DATABASE_ERD.md` | Mermaid ERD and integrity rules | Complete |
| `design/DESIGN_SYSTEM.md` | Tokens, typography, components, animations | Complete |
| `design/UI_SCREEN_INVENTORY.md` | Screens and states | Complete |
| `design/RESPONSIVE_BEHAVIOUR.md` | Breakpoints and viewport matrix | Complete |
| `design/SCREENSHOT_INDEX.md` | Generated index for all screenshots | Complete |
| `functionality/FEATURE_SPECIFICATIONS.md` | Structured feature specs | Complete |
| `functionality/USER_FLOWS.md` | Core journeys and failure journeys | Complete |
| `functionality/BUSINESS_LOGIC.md` | Canonicalization, verification, settlement | Complete |
| `functionality/VALIDATION_AND_ERRORS.md` | Validation and error codes | Complete |
| `implementation/IMPLEMENTATION_GUIDE.md` | Dependency-order build guide | Complete |
| `implementation/BUILD_ENVIRONMENT.md` | Setup, env, DB, deployment | Complete |
| `implementation/BUILD_COMMANDS.md` | Verified commands | Complete |
| `implementation/FILE_STRUCTURE.md` | Source tree responsibilities | Complete |
| `implementation/DECISIONS_AND_GOTCHAS.md` | Decisions, contradictions, pitfalls | Complete |
| `implementation/BACKEND_AND_NOBUS_DEPLOYMENT.md` | Backend build, Nobus stack, migrations, TLS verification | Complete |
| `testing/ONLINE_OFFLINE_TESTING.md` | Real online→offline→relay rehearsal procedure | Complete |
| `scripts/deploy/docker-compose.yml` | Four-service Nobus stack template | Complete |
| `scripts/deploy/Caddyfile` | HTTPS reverse proxy template | Complete |
| `scripts/deploy/Dockerfile.frontend` | Frontend static build template | Complete |
| `scripts/deploy/nginx.conf` | SPA fallback config for frontend container | Complete |
| `scripts/deploy/.env.example` | Safe placeholder environment template | Complete |
| `playbooks/SINGLE_BUILDER_PLAYBOOK.md` | One-builder order and checks | Complete |
| `playbooks/TWO_BUILDER_PLAYBOOK.md` | Two-builder ownership and git plan | Complete |
| `playbooks/COMPETITION_TIME_STRATEGY.md` | P0/P1/P2 and time allocation | Complete |
| `playbooks/INTEGRATION_GUIDE.md` | Merge and mismatch procedure | Complete |
| `playbooks/TROUBLESHOOTING.md` | Failure scenarios and fallbacks | Complete |
| `prompts/MASTER_REBUILD_PROMPT.md` | Full rebuild agent prompt | Complete |
| `prompts/SINGLE_BUILDER_PROMPT.md` | Solo builder prompt | Complete |
| `prompts/BACKEND_BUILDER_PROMPT.md` | Builder A prompt | Complete |
| `prompts/FRONTEND_BUILDER_PROMPT.md` | Builder B prompt | Complete |
| `prompts/INTEGRATION_COORDINATOR_PROMPT.md` | Coordinator prompt | Complete |
| `testing/TESTING_AND_ACCEPTANCE.md` | Test evidence and gates | Complete |
| `testing/FUNCTIONAL_TEST_CHECKLIST.md` | Functional scenarios | Complete |
| `testing/UI_VERIFICATION.md` | Visual comparison procedure | Complete |
| `testing/SMOKE_TESTS.md` | Five must-never-break flows | Complete |
| `scripts/capture-screenshots.cjs` | Full Playwright capture script | Complete |
| `scripts/capture-affected-states.cjs` | Targeted recapture script | Complete |
| `scripts/generate-screenshot-index.cjs` | Screenshot index generator | Complete |
| `screenshots/**` | 93 reference screenshots and evidence | Complete for captured states |
| `manifests/FILE_INVENTORY.md` | This file | Complete |
| `manifests/DEPENDENCY_INVENTORY.md` | Versions | Complete |
| `manifests/DOCUMENTATION_STATUS.md` | QC checklist | Complete |

## Source applications inspected

| Path | Role in kit |
| --- | --- |
| `bank/src/**` | Product UI reference |
| `rehearsal/backend/app/**` | Core API reference |
| `rehearsal/client/src/**` | Protocol reference |
| `00`–`13` numbered root specs | Authoritative requirements and plans |
| `rehearsal/INTEGRATION_NOTES.md` | Cross-runtime contract notes |
| `.workbuddy-ai/memory/2026-11-22.md` | Factual development history |

Not captured in screenshots: Loans and Profile sheets, Home send/receive/history sheets, loading skeleton frames. They are documented in source and feature specs.
