# Smoke Tests

Run these smallest sequences before every demo and after every merge.

## Five flows that must never break

1. **Boot** — app loads, RoleGate visible, no console errors.
2. **Demo lock** — Customer locks ₦10,000 and sees OAC.
3. **Offline sign/accept** — Customer signs ₦2,000; Merchant verifies and stores receipt.
4. **Relay/settle** — Gateway relays; outbox shows `SETTLED (SIMULATED)`.
5. **Live health** — with backend running, RoleGate shows live badge.

## Quick manual sequence (demo)

```text
Open http://localhost:5174
Choose Customer
Choose ₦10,000 → Lock funds
Spend offline via QR → ₦2,000 → Sign payment token
Press Escape to close QR sheet
Switch terminal role → Merchant
Enter 2000 → Create invoice QR
Paste the auth token from Customer (single-device) or scan on HTTPS
Confirm green receipt
Switch terminal role → Gateway
Relay all
Confirm settlement ledger shows clearing reference
```

## API smoke

```powershell
curl http://localhost:8000/api/v1/health
curl http://localhost:8000/docs
```

Expected health fields: `status`, `environment`, `version`, `timestamp`, `database`, `issuer_key_loaded`, `issuer_pubkey_hex`.

## Build smoke

```powershell
cd bank
npm test
npm run typecheck
npm run build
```

## Pass criteria

- No uncaught console errors.
- No `SETTLED (SIMULATION)` spelling.
- No real-money language.
- All statuses visible in UI are documented ones.
- A fresh reload preserves role, OAC and outbox.
