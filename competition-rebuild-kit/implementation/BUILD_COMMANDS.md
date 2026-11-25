# Build Commands

Commands verified in the reference workspace.

## Repository root

```powershell
git status --short
git log --oneline -10
```

## Backend

```powershell
cd rehearsal/backend
.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider
# expected: 39 passed

.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
.\.venv\Scripts\alembic.exe upgrade head
.\.venv\Scripts\python.exe -m scripts.seed_demo_data
```

macOS/Linux:

```bash
cd rehearsal/backend
.venv/bin/python -m pytest -q -p no:cacheprovider
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
.venv/bin/alembic upgrade head
.venv/bin/python -m scripts.seed_demo_data
```

## Rehearsal client

```powershell
cd rehearsal/client
npm test
# expected: 86 passed, 3 skipped
npm run build
npm run dev
```

Live E2E:

```powershell
$env:RIFT_E2E_BASE_URL = 'http://127.0.0.1:8011'
npx vitest run src/__tests__/integration.e2e.test.ts
```

Relay auth E2E variables: `RELAY_API_KEY` on backend and `VITE_RELAY_API_KEY` on client.

## Bank product PWA

```powershell
cd bank
npm test
# expected: 8 tests passed (engine + batch codec)
npm run typecheck
npm run build
npm run dev
```

## Screenshots

The capture script expects Playwright to be installed and a dev server running on 5174 (and optionally 5173 for auth screens).

```powershell
# From repository root, with dev servers running
$env:PLAYWRIGHT_MODULE = '<path-to-playwright>'
node competition-rebuild-kit\scripts\capture-screenshots.cjs
node competition-rebuild-kit\scripts\generate-screenshot-index.cjs
```

The script uses installed Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe` by default; override with `CHROME_PATH`.

## Smoke checks

```powershell
Invoke-WebRequest http://localhost:8000/api/v1/health -UseBasicParsing
Invoke-WebRequest http://localhost:5174 -UseBasicParsing
Invoke-WebRequest http://localhost:5173 -UseBasicParsing
```

Expected: health JSON with `status` and `issuer_key_loaded`; frontends return HTML with HTTP 200.
