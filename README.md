# RIFT — Devions Bank (competition rebuild)

An offline-first Ed25519 payment demo with three browser terminals (Customer, Merchant, Gateway)
and a FastAPI simulated core. **No real money moves. Every successful settlement is labelled
`SETTLED (SIMULATED)`.**

## Quick start (native)

```bash
# Core
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m pytest -q
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# App (second terminal)
cd frontend
npm install
npm run dev     # http://localhost:5174
```

The frontend probes `GET /api/v1/health`. If a live issuer is available it registers the
customer and merchant automatically; otherwise it uses the local simulated issuer (demo mode).

## Golden loop

1. **Customer** → RIFT → lock funds into an Offline Allocation Certificate (OAC).
2. **Customer** → scan the merchant's invoice QR → approve → copy/save the `R1.` auth token.
3. **Merchant** → paste/scan the auth token → local Ed25519 verification → receipt in outbox.
4. **Gateway** → ingest the exported batch → relay to core → `SETTLED (SIMULATED)`.

Deterministic transaction IDs, canonical JSON signing, issuer signatures, customer signatures,
OAC expiry, sequence anti-replay, duplicate-invoice rejection and overspend protection are all
enforced in both the local demo core and the FastAPI core.

## Docker / Nobus Cloud

```bash
cp .env.example .env
# generate every secret in .env (openssl rand -hex 32)

# Local container stack: http://localhost:8080, API via same-origin /api
docker compose up -d --build

# Public HTTPS deployment with Caddy (DNS must point to the VM)
docker compose --profile tls up -d --build
```

- `frontend` serves the built SPA on nginx and proxies `/api` to `backend:8000`.
- `backend` boots the schema idempotently, signs OACs with `RIFT_ISSUER_PRIVATE_KEY_HEX`,
  verifies Ed25519 signatures and settles only in simulation.
- `postgres:15-alpine` persists ledger state in the `postgres_data` volume.
- Optional Caddy profile terminates TLS and routes `/api/*` to the core.

Health: `curl http://localhost:8080/api/v1/health` (or `https://$RIFT_DOMAIN/api/v1/health`).

To use Nobus managed PostgreSQL instead of the container, remove the `postgres` service and
set `DATABASE_URL` in `.env`, passing it to the backend environment.

## Security note

This is a demonstration only. Bearer tokens are user IDs, the relay/admin keys are shared
secrets, and all balances are mock kobo. Do not connect it to real payment rails.
