# Two-Builder Playbook

Two agents work in parallel without file collisions.

## Responsibilities

### Builder A — Backend, data and integration

Owns: FastAPI app, Pydantic schemas, SQLAlchemy models, Alembic migration, seed script, ingestion service, backend tests, backend env file.

Does **not** own: frontend screens, UI components, design tokens, frontend package.json, frontend env files.

### Builder B — Frontend, UI and user experience

Owns: PWA app shell, contexts, screens, components, protocol libraries, frontend tests, frontend package.json, frontend env files, Vite config.

Does **not** own: backend routers, models, schemas, services, migrations, backend env files.

## File ownership matrix

| Path / file | Owner | Other builder must not modify |
| --- | --- | --- |
| `backend/app/**` | A | Yes |
| `backend/alembic/**` | A | Yes |
| `backend/scripts/**` | A | Yes |
| `backend/tests/**` | A | Yes |
| `backend/requirements.txt` | A | Yes |
| `backend/.env*` | A | Yes |
| `frontend/src/**` | B | Yes |
| `frontend/package.json`, lockfile | B | Yes |
| `frontend/vite.config.ts` | B | Yes |
| `frontend/.env*` | B | Yes |
| `frontend/src/lib/api.ts` | B | Yes, implements A's contract |
| Shared PRD/specs | Neither; coordinator only | Yes |
| Root README | Coordinator | Yes |
| `docker-compose.yml`, `Caddyfile` | Coordinator or A after B approval | B must not independently change |

## Contracts first

Before work starts, both builders agree on `architecture/API_CONTRACTS.md` and `architecture/DATA_MODEL.md`.

- A owns the authoritative backend contract.
- B implements against it and may use mock responses while endpoints are unavailable.
- Any contract change requires a message to the other builder and an update to the API doc.

## Git collaboration strategy

Use separate branches, never the same working directory.

```powershell
git switch main
git pull
git switch -c buildday/backend
git switch -c buildday/frontend
```

If using worktrees:

```powershell
git worktree add ..\buildday-backend -b buildday/backend main
git worktree add ..\buildday-frontend -b buildday/frontend main
```

Commit naming:

- `feat(backend): ...`
- `test(backend): ...`
- `feat(frontend): ...`
- `fix(ui): ...`
- `chore(env): ...`

Commit at least every 30 minutes after a verified stage.

## Integration order

1. Confirm contracts and ownership.
2. A exposes health and register first.
3. B wires API client and role gate against contract.
4. A exposes allocations issue/status.
5. B wires customer lock and reconciliation.
6. A exposes relay and status.
7. B wires merchant/gateway relay and outbox status.
8. Integrate branches:

```powershell
git switch main
git merge --no-ff buildday/backend
git merge --no-ff buildday/frontend
```

9. Run backend tests, frontend tests and both builds.
10. Run visual comparison and smoke tests.
11. Freeze with a tag or commit.

## Conflict handling

- Package/lockfile conflicts: Builder B owns frontend manifests; A must not touch them.
- Env conflicts: each builder owns their own env template; coordinator merges deployment env.
- API contract conflicts: Builder A's code is authoritative; B updates client types.
- UI conflicts: Builder B is authoritative.
- Broken merge: revert the merge, integrate the branch whose tests are green, then re-apply the other branch in smaller commits.

## When one builder finishes early

- A finishes first: keep backend running, provide curl examples and mock payloads to B; do not start redesigning UI.
- B finishes first: use mocked API responses that exactly match contracts; do not invent backend endpoints.
- Coordinator runs integration tests as soon as both branches are available.
