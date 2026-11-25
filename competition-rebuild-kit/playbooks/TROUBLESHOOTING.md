# Troubleshooting

## Dependency installation fails

**Symptoms:** npm/pip errors, peer dependency conflicts, slow network.
**Diagnosis:** `node -v`, `npm -v`, `python --version`, `pip check`.
**Fix:** Use Node 20+ and Python 3.11+; delete `node_modules` and reinstall from lockfile; use a fresh venv.
**Fallback:** Use already-installed reference workspaces for verification; rebuild the manifest later.

## Database connection fails

**Symptoms:** 500 on health, `database: unavailable`.
**Diagnosis:** Check `DATABASE_URL`, SQLite file path, PostgreSQL reachability.
**Fix:** For rehearsal use `sqlite+aiosqlite:///./rift_dev.db`; for PostgreSQL verify host, port, credentials and `asyncpg`.
**Fallback:** Demo mode works without the backend.

## Migration errors

**Symptoms:** `table already exists`, `Target database is not up to date`.
**Cause:** Checked-in SQLite DB lacks `alembic_version` but already has tables.
**Fix:** Use a fresh DB file for Alembic, or rely on `AUTO_CREATE_SCHEMA=true`.
**Fallback:** Delete/rename the throwaway SQLite DB and restart.

## API errors

**Symptoms:** 401, 403, 404, 422, relay rejection results.
**Diagnosis:** Inspect `error.code`, request headers, body schema and `results[]`.
**Fix:** Match `API_CONTRACTS.md`; check bearer prefix and relay key.
**Fallback:** Bank falls back to demo for health/registration failures; relay rejections must be surfaced, not hidden.

## Authentication failures

**Symptoms:** 401 UNAUTHORIZED on allocations/status.
**Cause:** Bearer token missing, wrong prefix, unknown user or role mismatch.
**Fix:** Send `Authorization: Bearer usr_<uuid>` or `mch_<uuid>`; allocations require CUSTOMER.
**Fallback:** Demo mode.

## Frontend build fails

**Symptoms:** TypeScript errors, missing modules.
**Diagnosis:** `npm run typecheck`, `npm run build`.
**Fix:** Follow `IMPLEMENTATION_GUIDE.md` dependency order; check imports and package versions.
**Fallback:** Revert to last green stage; do not commit broken builds.

## Port conflicts

**Symptoms:** Vite or Uvicorn says address in use.
**Diagnosis:** `netstat -ano | findstr :5174`, same for 8000/5173.
**Fix:** Stop the process or pass another port; update proxy/env accordingly.
**Fallback:** Use alternate ports and document them.

## Environment variable problems

**Symptoms:** Live mode not detected, relay key rejected, frontend hits wrong URL.
**Diagnosis:** Log sanitized `getApiBaseUrl()` result; check `.env` loaded by Vite; check backend settings.
**Fix:** `VITE_API_BASE_URL=http://localhost:5174` for dev proxy; backend `RELAY_API_KEY` must match `VITE_RELAY_API_KEY`.
**Fallback:** Clear env to use demo-only mode.

## Broken routes

**Symptoms:** Blank screen after role selection.
**Cause:** Role stored but identity readiness failed, or screen component error.
**Fix:** Clear `devions-role-v1`; check console; verify IndexedDB identity.
**Fallback:** Reload to re-probe mode.

## Merge conflicts

**Symptoms:** Git conflict markers in manifests or env files.
**Fix:** Follow ownership matrix; frontend manifests belong to Builder B, backend to Builder A.
**Fallback:** `git merge --abort`, integrate the green branch first.

## Agent context loss

**Symptoms:** Fresh agent starts redesigning or forgets decisions.
**Fix:** Give it `MASTER_REBUILD_PROMPT.md`, `AGENT_EXECUTION_MEMORY.md` and the progress file.
**Fallback:** Resume from the last green stage and commit.

## Browser screenshot failures

**Symptoms:** Playwright cannot find executable; dialogs intercept clicks.
**Fix:** Set `CHROME_PATH`; use Escape to close sheets; run dev servers in the same shell as the capture script.
**Fallback:** Use manual screenshots from the stored kit.

## Third-party service downtime

**Symptoms:** Cloudflare tunnel or Nobus unavailable.
**Fix:** Use localhost for desktop testing and paste-token fallback for phone testing.
**Fallback:** Demo mode needs no external service.

## Deployment failures

**Symptoms:** Container exits, bad interpreter, 403 from Vite tunnel.
**Fix:** Normalize CRLF in entrypoint; add tunnel host to `allowedHosts`; provide required env vars.
**Fallback:** Local dev servers with HTTPS tunnel are sufficient for most demos.

## Minimum viable offline setup

- Backend not required: run `npm run dev` in `bank/` and use demo mode.
- No camera: use raw token text and paste fields.
- No internet: PWA shell and IndexedDB state remain available.
- No PostgreSQL: use SQLite rehearsal DB.

## Never do

- Do not delete user data without confirming demo reset.
- Do not bypass authentication in production-style deployment.
- Do not expose admin secret or relay key in screenshots/docs.
