# Backend Build and Nobus Deployment

This document exists because live and online→offline testing require a real backend. Demo mode works without it, but **live mode, relay settlement and HTTPS camera scanning do not**.

## 1. What must be built

| Component | Build artifact | Runtime |
| --- | --- | --- |
| Backend | Docker image from `backend/Dockerfile` | FastAPI + Uvicorn on port 8000 inside container |
| Frontend | Docker image from `frontend/Dockerfile` | Static Vite build served by nginx on port 80 inside container |
| Reverse proxy | `caddy:2.7-alpine` | TLS termination on 80/443; routes `/api/*` to backend, `/` to frontend |
| Database | `postgres:15-alpine` or Nobus managed PostgreSQL 15 | Persistent volume `postgres_data` |

Templates are in `competition-rebuild-kit/scripts/deploy/`:
- `docker-compose.yml`
- `Caddyfile`
- `Dockerfile.frontend`
- `nginx.conf`
- `.env.example`

Copy these into the competition repository before deployment.

## 2. Local backend build and verification (Ubuntu/Windows)

### Windows PowerShell

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

### Ubuntu / Nobus VM

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m pytest -q -p no:cacheprovider
uvicorn app.main:app --reload --port 8000
```

Health check:

```bash
curl http://localhost:8000/api/v1/health
```

Expected JSON includes `status`, `issuer_key_loaded: true`, `database: connected` (in a properly configured environment).

## 3. Nobus VM preparation

Assumptions from `09_NOBUS_DEPLOYMENT_CHECKLIST.md`: Ubuntu 22.04 LTS, Nobus Cube `c1.medium` or equivalent, inbound ports 22/80/443 open.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin git openssl curl
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

## 4. Copy deployment templates

From the competition repository root:

```bash
mkdir -p deploy
cp competition-rebuild-kit/scripts/deploy/docker-compose.yml ./docker-compose.yml
cp competition-rebuild-kit/scripts/deploy/Caddyfile ./deploy/Caddyfile
cp competition-rebuild-kit/scripts/deploy/nginx.conf ./frontend/nginx.conf
cp competition-rebuild-kit/scripts/deploy/Dockerfile.frontend ./frontend/Dockerfile
cp competition-rebuild-kit/scripts/deploy/.env.example ./.env
chmod 600 .env
```

Assumed repo layout:

```text
competition-repo/
├── docker-compose.yml
├── .env
├── deploy/Caddyfile
├── backend/            # rebuilt from documentation, contains Dockerfile and requirements.txt
└── frontend/           # rebuilt from documentation, contains package.json and src/
```

## 5. Generate secrets — do not use documentation defaults

```bash
openssl rand -hex 32   # use for ISSUER_PRIVATE_KEY_HEX
openssl rand -hex 32   # use for ADMIN_SECRET
openssl rand -hex 32   # use for DB_PASSWORD
openssl rand -hex 32   # use for RELAY_API_KEY
```

Edit `.env`:

```env
RIFT_DOMAIN=portal.example.test
ADMIN_EMAIL=admin@example.test
DB_PASSWORD=<generated>
ISSUER_PRIVATE_KEY_HEX=<generated 64-hex>
ADMIN_SECRET=<generated>
RELAY_API_KEY=<generated>
VITE_API_BASE_URL=https://portal.example.test
VITE_RELAY_API_KEY=<same as RELAY_API_KEY>
```

- `RIFT_DOMAIN` must be a real DNS name pointing at the VM; Caddy needs it for TLS.
- `ADMIN_EMAIL` is only the Let's Encrypt contact; use a valid address you control.
- `VITE_API_BASE_URL` is baked into the frontend at build time. Changing it requires `docker compose up -d --build` again.
- Never commit `.env`.

## 6. Build and launch the stack

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

Expected: `caddy`, `frontend`, `backend` and `postgres` are `Up`.

Normalize line endings before building if the backend entrypoint fails with `bad interpreter`:

```bash
sed -i 's/\r$//' backend/docker-entrypoint.sh
sed -i 's/\r$//' backend/Dockerfile
docker compose up -d --build backend
```

## 7. Database migration and seed

The backend entrypoint runs `alembic upgrade head` when `RUN_MIGRATIONS=true` (default). Verify or run manually:

```bash
docker compose exec backend alembic upgrade head
docker compose exec backend python -m scripts.seed_demo_data
```

Use a fresh PostgreSQL volume. Do **not** copy the rehearsal SQLite `rift_dev.db` into PostgreSQL; it lacks `alembic_version`.

## 8. Public verification

```bash
curl -I https://$RIFT_DOMAIN
curl https://$RIFT_DOMAIN/api/v1/health
```

Check in browser:
- `https://<domain>/` loads Devions Bank.
- Service worker registers (Application → Service Workers in DevTools).
- App shows live badge when `issuer_key_loaded` is true.
- Camera button is enabled because the origin is HTTPS.

If using Nobus managed PostgreSQL instead of the container:
- Remove the `postgres` service and its `depends_on` from `docker-compose.yml`.
- Set `DATABASE_URL` in `.env` to the managed `postgresql+asyncpg://...` URL.
- Add `DATABASE_URL=${DATABASE_URL}` to the backend environment in compose.

## 9. Backend smoke sequence

```bash
curl https://$RIFT_DOMAIN/api/v1/health
curl -X POST https://$RIFT_DOMAIN/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"user_type":"CUSTOMER","display_name":"Smoke Customer","phone_number":"+2348000000099","public_key_hex":"1111111111111111111111111111111111111111111111111111111111111111"}'
```

Expected: health 200; register 201 with `user_id` beginning `usr_`. Duplicate key/phone returns 409 — that is correct.

## 10. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Caddy TLS fails | DNS must point to VM; ports 80/443 open; `RIFT_DOMAIN` in `.env` correct. |
| Frontend blank page | Check `docker compose logs frontend`; ensure nginx SPA fallback config copied. |
| API 502/404 | Check `docker compose logs backend`; Caddy `reverse_proxy backend:8000`; health via localhost. |
| Live badge absent | Frontend `VITE_API_BASE_URL` must be the public HTTPS origin; rebuild frontend after changing. |
| Camera disabled | Origin must be HTTPS or localhost. |
| Relay 401 | `VITE_RELAY_API_KEY` must match backend `RELAY_API_KEY`. |
| Migration fails | Use fresh Postgres volume; do not reuse rehearsal SQLite. |
| `bad interpreter` | Normalize CRLF in backend entrypoint/Dockerfile. |
