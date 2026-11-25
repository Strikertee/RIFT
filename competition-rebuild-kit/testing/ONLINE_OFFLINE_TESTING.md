# Online → Offline Real-World Test

Use this when the backend is actually deployed on Nobus and the demo must go online first, then offline.

## Prerequisites

- Backend deployed and HTTPS health endpoint returns `issuer_key_loaded: true`.
- Frontend built with `VITE_API_BASE_URL=https://<your-domain>`.
- PWA loaded once online so the service worker caches the app shell.
- Camera path uses HTTPS; paste-token fallback still available.
- Fresh identities or `/sim/reset` completed before the run.

## Critical gotcha

The bank app probes `/api/v1/health` on load. If the device is already offline when the page reloads, the probe fails and `forceDemoMode()` makes the session sticky in demo mode until reload. Therefore:

1. Load and register while online.
2. Confirm the live badge.
3. Go offline **without reloading** for the offline payment phase.
4. Come back online, then reload once to re-probe live mode before relay if the badge switched.

## Phase A — Online setup

| Step | Action | Expected |
| --- | --- | --- |
| A1 | Open `https://<domain>/` | RoleGate shows `RIFT CORE · LIVE` |
| A2 | DevTools → Application → Service Workers | Worker registered and activated |
| A3 | Choose Customer | Identity registers with Core; no demo fallback toast |
| A4 | Lock ₦10,000 | OAC issued by Core; allocation card shows backend OAC id |
| A5 | Check `/api/v1/allocations/{oac_id}` via curl with bearer id | Allocation ACTIVE, reserved 100000 |
| A6 | Choose Merchant | Merchant registers with Core; header shows `Core live` |

## Phase B — Go offline

Use Chrome DevTools → Network → Offline, or enable airplane mode. Do not reload.

| Step | Action | Expected |
| --- | --- | --- |
| B1 | Merchant creates ₦2,000 invoice | Invoice QR and raw token appear offline |
| B2 | Customer opens RIFT → Spend offline via QR → amount ₦2,000 → Sign | Auth QR generated offline; deterministic `tx_` id |
| B3 | Copy auth token or scan over local QR | No network request required |
| B4 | Merchant accepts token | Green receipt; outbox status `PENDING_RELAY` |
| B5 | Refresh merchant page while offline only if PWA shell is cached | App shell loads; do not rely on live badge staying live |

## Phase C — Reconnect and relay

| Step | Action | Expected |
| --- | --- | --- |
| C1 | Disable offline mode | Browser online |
| C2 | Reload once if badge is demo | Live badge returns |
| C3 | Gateway or merchant → Relay all | `POST /api/v1/transactions/relay` appears in Network tab |
| C4 | Inspect response | `results[0].status = SETTLED (SIMULATED)`; `validation_result = VALID` |
| C5 | Check outbox/ledger | Clearing reference `SIM_SETTLE_...` displayed |
| C6 | Query transaction status endpoint | HTTP 200 with settled status |

## Verification commands on the server

```bash
curl https://$RIFT_DOMAIN/api/v1/health
docker compose logs --tail=100 backend
docker compose exec backend alembic current
```

## Failure checks

| Failure | Correct response |
| --- | --- |
| Offline reload before first online load | PWA shell may not be cached; reload online first |
| Demo badge after offline reload | Expected sticky fallback; reload online to re-probe |
| Camera disabled | Origin is not HTTPS or localhost |
| Relay 401 | `VITE_RELAY_API_KEY` does not match backend `RELAY_API_KEY` |
| `TRANSACTION_ID_MISMATCH` | QR tx format or derivation diverged; do not bypass |
| `QUARANTINED_COLLISION` | Same `(oac_id, seq_no)` replayed; correct anti-replay behaviour |
| `REJECTED_OVERSPEND` | Spend exceeded allocation; correct ledger protection |
| Blank page offline | Service worker not registered or assets not precached |

## Reset before next run

```bash
curl -X POST https://$RIFT_DOMAIN/api/v1/sim/reset \
  -H "X-Admin-Secret: $ADMIN_SECRET"
```

Then clear browser IndexedDB/localStorage or use a fresh profile/device. Reusing a phone number yields `PHONE_ALREADY_REGISTERED` by design.
