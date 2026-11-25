# Build Environment

## Operating system assumptions

Reference development was performed on Windows 11 with PowerShell 5.1. Commands for macOS/Linux are given where they differ. Node 20+ and Python 3.11+ are required.

## Required software

- Git.
- Node.js 20+ and npm.
- Python 3.11+ with venv.
- Docker Desktop (optional; required only for container deployment rehearsal).
- Chromium/Chrome for PWA and camera testing.
- Cloudflare tunnel or other HTTPS tunnel for phone camera testing over LAN.

## Repository setup

```powershell
git init
# create the project structure from FILE_STRUCTURE.md
```

Do not copy `bank/` or `rehearsal/` source directories into the competition repository. Recreate from this kit.

## Backend setup (Windows PowerShell)

```powershell
cd rehearsal/backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

macOS/Linux:

```bash
cd rehearsal/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:8000/docs`.

## Environment variables

Backend (`rehearsal/backend/.env.example`, safe names only):

| Variable | Purpose |
| --- | --- |
| `ENVIRONMENT` | `development` / `test` / `production`; production requires issuer key |
| `APP_VERSION` | Reported API version |
| `DATABASE_URL` | `sqlite+aiosqlite:///./rift_dev.db` or PostgreSQL async URL |
| `RIFT_ISSUER_PRIVATE_KEY_HEX` | 32-byte Ed25519 seed; generate a fresh one for competition |
| `ISSUER_KEY_VERSION` | e.g. `v1` |
| `ADMIN_SECRET` | Secret for `/sim/reset`; do not use documented defaults |
| `RELAY_API_KEY` | Optional shared secret for relay |
| `MOCK_STARTING_BALANCE_KOBO` | Starting mock account balance |
| `CORS_ORIGINS` | Comma-separated origins; `*` for rehearsal |
| `AUTO_CREATE_SCHEMA` | Create tables at startup when true |

Bank frontend (`bank/.env.example`, safe names only):

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Base URL for Core; `http://localhost:5174` uses Vite `/api` proxy |
| `VITE_RELAY_API_KEY` | Must match backend `RELAY_API_KEY` |

Rehearsal client additionally supports `VITE_ISSUER_PUBKEY_HEX`, `VITE_HTTPS_KEY_PATH` and `VITE_HTTPS_CERT_PATH`.

Never commit real keys, tokens or secrets.

## Database and migrations

Rehearsal uses SQLite and can auto-create schema. For Alembic use a fresh database:

```powershell
.\.venv\Scripts\alembic.exe upgrade head
.\.venv\Scripts\python.exe -m scripts.seed_demo_data
```

The checked-in `rift_dev.db` lacks `alembic_version`; do not run Alembic against it.

Production target is PostgreSQL 15 via `postgresql+asyncpg://...`.

## Frontend setup

```powershell
cd bank
npm install
Copy-Item .env.example .env
npm run dev
```

macOS/Linux:

```bash
cd bank
npm install
cp .env.example .env
npm run dev
```

Bank runs on `http://localhost:5174`, proxies `/api` to `http://localhost:8000`, and allows `.trycloudflare.com` hosts.

Rehearsal client:

```powershell
cd rehearsal/client
npm install
npm run dev
```

It runs on port 5173 with its own `/api` proxy.

## Production build

```powershell
cd bank
npm run build
npm run preview
```

`vite preview` does not proxy `/api`; for live mode in preview set `VITE_API_BASE_URL` to the backend origin.

## Deployment

The `09_NOBUS_DEPLOYMENT_CHECKLIST.md` stack was proposed; this kit now supplies working templates in `scripts/deploy/`: `docker-compose.yml`, `Caddyfile`, `Dockerfile.frontend`, `nginx.conf` and `.env.example`. Use `BACKEND_AND_NOBUS_DEPLOYMENT.md` for the full build, migration, secret and verification sequence. The application source itself remains unmodified; these are independent deployment templates.

Backend container commands:

```powershell
docker build -t rift-backend rehearsal/backend
docker run --rm -p 8000:8000 --env-file rehearsal/backend/.env rift-backend
```

Normalize CRLF line endings in `docker-entrypoint.sh` before building on Linux.

## External services and connectivity

- Backend and PWA dev servers require no internet.
- Camera on phone requires an HTTPS tunnel such as Cloudflare quick tunnel.
- Docker image pulls and npm/pip installs require internet.
- Nobus deployment requires SSH access, a public domain and TLS.
