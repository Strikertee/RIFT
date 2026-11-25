# Agent Execution Memory

This is an objective development record for a fresh agent taking over. It is not private reasoning; it is a reproducible action and decision log.

## Development sequence observed from git history

1. `f88b838` — initial Devions Bank PWA with RIFT offline spending.
2. `4366f9b`, `1c5962c`, `5366661` — bank UI redesign, branding polish and layout refinement on `ui/bank-redesign`.
3. `fc7b655` — added RIFT merchant and gateway roles with offline engine on `ui/bank-rift-roles`.
4. `0178019` — fixed phone-origin failures and aligned bank with Core:
   - Replaced `crypto.randomUUID()` with `crypto.getRandomValues()` helpers because non-secure HTTP LAN origins have no `randomUUID`.
   - Made merchant invoice button hardened with visible errors, busy state, typed amount and copy-token.
   - Added raw token text under QR codes for two-phone transfer without camera.
   - Added `allowedHosts: ['.trycloudflare.com']` to Vite for tunnel testing.
   - Changed live allocation duration from 72 to 6 hours because backend caps `duration_hours` at 24.
5. `599bee5` — chunked merchant batch export into `RB.<total>.<index>.<payload>` QRs for optical gateway transfer; one receipt JSON was ~2.6 KB.
6. `853335a` — smaller batch QR chunks for easier scanning.
7. `f7607f5` — larger, black-on-white scan targets.
8. `ba36704` — explained empty batch export in merchant sync tab.
9. `1c9263d` — relayed receipts in OAC sequence order.

## Commands executed during verification

- Backend: `.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider` → 39 passed.
- Rehearsal client: `npm test` → 86 passed, 3 skipped; `npm run build` → passed.
- Bank: `npm test` → 8 tests passed; `npm run build` → passed; `npm run typecheck` → passed.
- Screenshot capture: custom Playwright script using installed Chrome, 93 screenshots across 9 viewports.
- Live E2E previously recorded in `rehearsal/INTEGRATION_NOTES.md`: 3 passed with a throwaway SQLite database; relay-key E2E 3 passed with `RELAY_API_KEY` and `VITE_RELAY_API_KEY`.

## Major files changed during development

- `bank/src/rift/engine.ts` — mode detection, registration, live/demo fallback, lock, sign, accept, relay, reconcile, batch ingest, fraud drill.
- `bank/src/rift/RoleContext.tsx` — role persistence, mode event listener, identity readiness.
- `bank/src/rift/MerchantApp.tsx` — merchant terminal, invoice QR, accept, batch export.
- `bank/src/rift/GatewayApp.tsx` — gateway ingest, relay, settlement ledger.
- `bank/src/screens/Rift.tsx` — customer lock and spend QR flow.
- `bank/src/rift/lib/qr-codec.ts` — v2 compact auth QR; transaction ID decoded with UUID formatting.
- `bank/src/rift/lib/batch-codec.ts` — optical batch chunking.
- `bank/src/rift/lib/api.ts` — API client, LAN origin proxy rewrite, secure idempotency keys.
- `bank/src/rift/lib/format.ts` — secure nonce generation without `crypto.randomUUID`.
- `bank/vite.config.ts` — proxy, PWA dev options, Cloudflare tunnel allowed host.
- `rehearsal/client/src/lib/qr-codec.ts` — same transaction-ID decode correction applied to reference client.
- `rehearsal/client/src/__tests__/qr-codec.test.ts` — sample transaction ID updated to canonical dashed format.

## Important decisions

- Bank is demo-first; rehearsal client fails closed without a backend. Both are intentional.
- Live mode registers customer/merchant identities with Core; gateway is a relay node and does not need a backend account.
- Demo fallback is sticky for the browser session to avoid repeated failed health probes.
- Unique phone, public key and merchant codes are generated on conflict retry to avoid `PHONE_ALREADY_REGISTERED` and related errors.
- Live allocation duration is 6 hours to satisfy backend validation and wireframe expectations.
- Batch QR chunks are 450 characters, format `RB.<total>.<index>.<payload>`, because full batch JSON is too dense for one QR.
- QR codes also render raw token text so two devices can transfer tokens by paste when camera is unavailable.
- `SETTLED (SIMULATED)` is canonical; legacy `SETTLED (SIMULATION)` is normalised by client helpers.

## Problems and solutions

| Problem | Solution that worked |
| --- | --- |
| Merchant QR button appeared to do nothing on phone LAN origin | Root cause was `crypto.randomUUID()` unavailable on non-secure context. Replaced with `crypto.getRandomValues()`. |
| Camera button unavailable on HTTP LAN | `Scanner.tsx` detects non-secure context, disables camera and shows explicit notice; paste fallback remains. |
| Vite 403 on Cloudflare tunnel | Added `.trycloudflare.com` to `server.allowedHosts`. |
| Live lock failed schema validation | Core caps `duration_hours` at 24; bank changed from 72 to 6. |
| Batch JSON too large for one QR | Added `batch-codec.ts` chunking and gateway reassembly. |
| Demo relay could reject valid sequential spends | Relay now sorts receipts in OAC sequence order. |
| Transaction ID mismatch after QR round-trip | v2 QR decoded `tx_` without UUID dashes; decoder now reconstructs dashed UUID layout to match Core. |
| Browser stale mode after backend starts | Mode cache TTL 15s; forced demo sticky until reload or reset. |

## Solutions that failed or were rejected

- Using `crypto.randomUUID()` directly on Lan HTTP origins.
- Assuming one QR can hold a full batch; 2.6 KB payload exceeded QR density targets.
- Sending `duration_hours: 72` to Core.
- Rendering the QR without raw token text; two-phone transfer was impossible without HTTPS camera.
- Treating `SETTLED (SIMULATION)` as canonical; it is a legacy alias.

## Things the next agent should not repeat

- Do not copy rehearsal code into the competition repository.
- Do not redesign the UI without first reading `DESIGN_SYSTEM.md` and the screenshots.
- Do not introduce real banking integrations; settlement is simulated.
- Do not change canonicalization or timestamp formatting; signatures will break.
- Do not use `Date.toISOString()` for OAC timestamps; it adds `.000Z`.
- Do not call `crypto.randomUUID()` in non-secure contexts.
- Do not assume the camera works on HTTP LAN origins.
- Do not mark an item complete without running the relevant test/build command.
