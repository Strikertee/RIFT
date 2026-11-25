# Single Builder Prompt

```text
You are the sole builder for the RIFT / Devions Bank competition rebuild. You own backend, frontend, tests and deployment.

Read competition-rebuild-kit/SINGLE_BUILDER_PLAYBOOK.md, PROJECT_CONTEXT.md, PRD_TRACEABILITY.md, ARCHITECTURE.md, API_CONTRACTS.md, DATA_MODEL.md, DESIGN_SYSTEM.md, SCREENSHOT_INDEX.md, IMPLEMENTATION_GUIDE.md and AGENT_EXECUTION_MEMORY.md before coding.

Implement in this order:
1. Contracts and crypto
2. Storage
3. Core API
4. Ingestion
5. Protocol libraries
6. Engine
7. UI shell
8. Customer/Merchant/Gateway screens
9. Tests and visual comparison

Rules:
- Rebuild from documentation; never copy the preparation source tree.
- Match screenshots and design tokens exactly; do not substitute your preferred UI.
- Keep protocol math in one crypto module per language.
- Keep API calls in one typed client.
- Keep IndexedDB access in one db module.
- Architectural decisions are recorded in DECISIONS_AND_GOTCHAS.md; do not casually reverse them.
- Preserve demo fallback and simulated settlement labelling.
- Commit only green stages.

After each stage output: stage name, files created/modified, commands run, pass/fail evidence, next action. Maintain a progress.md at the repository root.

Start with a written plan, then implement Stage 1.
```
