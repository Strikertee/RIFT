# RIFT Core — Builder A handoff

This folder is the FastAPI backend for the two-builder rebuild. It is complete against `competition-rebuild-kit/architecture/API_CONTRACTS.md` and `DATA_MODEL.md`. No frontend, root README, or shared specification file was modified.

## Status at handoff

- Branch: `buildday/backend`
- Shared baseline commit: `546b86d chore: seed rebuild kit baseline`
- Backend implementation commit: `3a88aaf feat(backend): build FastAPI core with deploy templates` (later fixes will be additional commits)
- Tests: **39 passed**
- Port: `8000`
- API prefix: `/api/v1`
- Docs: `http://localhost:8000/docs`

## Run locally

```bash
cd backend
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
cp .env.example .env
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

Tests:

```bash
.venv/Scripts/python.exe -m pytest -c pytest.ini -q
```

Fresh database with Alembic instead of auto-create:

```bash
# set DATABASE_URL=sqlite+aiosqlite:///./rift_dev.db and AUTO_CREATE_SCHEMA=false in .env
.venv/Scripts/alembic.exe upgrade head
.venv/Scripts/python.exe -m scripts.seed_demo_data
```

Do not run Alembic against a database that was created by `AUTO_CREATE_SCHEMA`; use a fresh file.

## Contract invariants Builder B can rely on

- All endpoints are under `/api/v1`.
- Amounts are integer kobo.
- API timestamps are `YYYY-MM-DDTHH:MM:SSZ`, no fractional seconds.
- Settled status is exactly `SETTLED (SIMULATED)`.
- `transaction_id` is `tx_` + 32 hex chars in dashed UUID layout.
- Registration returns `usr_<uuid>` for customers and `mch_<uuid>` for merchants.
- Bearer accepts `usr_`, `mch_`, or bare UUID.
- Relay returns HTTP 200 with per-record `results[]`; rejections are not top-level HTTP errors.
- Relay result field is `simulated_clearing_reference`; transaction status and settlements field is `simulated_clearing_ref`.
- If `RELAY_API_KEY` is configured, relay requires `X-Relay-Api-Key`.
- `/api/v1/sim/reset` requires `X-Admin-Secret`.
- `X-Idempotency-Key` and `X-RIFT-Client-Version` are accepted by HTTP but not used; idempotency is by `transaction_id`.
- In non-production, a deterministic development issuer key is used. Production requires `RIFT_ISSUER_PRIVATE_KEY_HEX` (64 hex chars).
- Never commit real issuer/admin/relay secrets.

## Endpoint map

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/api/v1/health` | none |
| POST | `/api/v1/auth/register` | none |
| POST | `/api/v1/allocations/issue` | Bearer customer |
| GET | `/api/v1/allocations/{oac_id}` | Bearer owner |
| POST | `/api/v1/transactions/relay` | optional `X-Relay-Api-Key` |
| GET | `/api/v1/transactions/{transaction_id}/status` | Bearer owner/merchant/admin |
| GET | `/api/v1/merchants/{merchant_id}/settlements` | Bearer merchant/admin |
| POST | `/api/v1/sim/reset` | `X-Admin-Secret` |

## curl examples

Health:

```bash
curl http://localhost:8000/api/v1/health
```

Register:

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"user_type":"CUSTOMER","display_name":"Bayo Commuter","phone_number":"+2348000000001","public_key_hex":"1111111111111111111111111111111111111111111111111111111111111111"}'
```

Issue allocation (replace the token):

```bash
curl -X POST http://localhost:8000/api/v1/allocations/issue \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer usr_<uuid>' \
  -d '{"amount_kobo":1000000,"duration_hours":6}'
```

Allocation status:

```bash
curl http://localhost:8000/api/v1/allocations/oac_<id> \
  -H 'Authorization: Bearer usr_<uuid>'
```

Relay shape (the frontend must generate signatures and the deterministic transaction ID):

```json
{
  "relay_node_id": "gateway-1",
  "transactions": [
    {
      "transaction_id": "tx_...",
      "oac_id": "oac_...",
      "seq_no": 1,
      "merchant_id": "mch_<uuid>",
      "amount_kobo": 200000,
      "currency": "NGN",
      "invoice_nonce": "<32 hex>",
      "customer_timestamp": 1760000000,
      "customer_pubkey_hex": "<64 hex>",
      "customer_signature_hex": "<128 hex>",
      "oac_token": {
        "oac_id": "oac_...",
        "customer_id": "usr_<uuid>",
        "customer_pubkey_hex": "<64 hex>",
        "allocated_amount_kobo": 1000000,
        "currency": "NGN",
        "issued_at": "2026-01-01T00:00:00Z",
        "expires_at": "2026-01-01T06:00:00Z",
        "issuer_key_version": "v1",
        "issuer_signature_hex": "<128 hex>"
      }
    }
  ]
}
```

`issuer_pubkey_version` is accepted as an alias for `issuer_key_version` in the OAC token.

Transaction status:

```bash
curl http://localhost:8000/api/v1/transactions/tx_<id>/status \
  -H 'Authorization: Bearer usr_<uuid>'
```

Merchant settlements:

```bash
curl http://localhost:8000/api/v1/merchants/mch_<uuid>/settlements \
  -H 'Authorization: Bearer mch_<uuid>'
```

Sim reset:

```bash
curl -X POST http://localhost:8000/api/v1/sim/reset \
  -H 'X-Admin-Secret: <secret>'
```

## httpx example for Builder B

```python
import httpx

base = "http://127.0.0.1:8000/api/v1"
with httpx.Client(base_url=base, timeout=10.0) as client:
    health = client.get("/health").json()
    assert health["status"] in {"healthy", "degraded"}
    register = client.post(
        "/auth/register",
        json={
            "user_type": "CUSTOMER",
            "display_name": "Bayo Commuter",
            "phone_number": "+2348000000100",
            "public_key_hex": "22" * 32,
        },
    ).json()
    token = register["user_id"]
    oac = client.post(
        "/allocations/issue",
        headers={"Authorization": f"Bearer {token}"},
        json={"amount_kobo": 1_000_000, "duration_hours": 6},
    ).json()
```

## Deployment

See `deploy/README.md` for both the manual console path and the scripted SSH path on Nobus VM. The backend-only compose file is `deploy/docker-compose.backend.yml`; the full-stack template is `deploy/docker-compose.full.yml` and becomes usable once Builder B supplies `frontend/Dockerfile`.

## Known implementation notes

- `PROVIDER_AUTHORISED (SIMULATION)` is transient inside one DB transaction; clients do not receive it as a persisted status.
- Only overspend rejections are persisted as transaction rows. Other rejections return per-record results and a later status lookup returns 404.
- Expiry marks an allocation `EXPIRED` but does not refund reserved funds.
- Merchant risk-limit columns exist but are not enforced, matching the reference behaviour.
- SQLite ignores `with_for_update()`; PostgreSQL enforces it. Unique constraints still protect replay races.
