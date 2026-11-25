# Testing and Acceptance

## Test evidence from reference workspace

| Suite | Command | Result |
| --- | --- | --- |
| Backend | `.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider` | 39 passed |
| Rehearsal client unit | `npm test` in `rehearsal/client` | 86 passed, 3 skipped |
| Rehearsal client build | `npm run build` | passed |
| Bank | `npm test` in `bank` | 8 passed |
| Bank typecheck | `npm run typecheck` | passed |
| Bank build | `npm run build` | passed |
| Live client E2E | `npx vitest run src/__tests__/integration.e2e.test.ts` with `RIFT_E2E_BASE_URL` | 3 passed |
| Relay-auth E2E | same with `RELAY_API_KEY` / `VITE_RELAY_API_KEY` | 3 passed |

## Acceptance gates

### Gate A — Crypto and data

- RFC 8032 test vector passes in TypeScript and Python.
- Canonical payloads are byte-identical across languages.
- Integer kobo everywhere.
- Unique constraints exist for `(oac_id, seq_no)` and `(merchant_id, invoice_nonce)`.
- `transaction_id` is deterministic and dashed `tx_` format.

### Gate B — Core API

- Health returns issuer key loaded in live mode.
- Registration returns correct `usr_`/`mch_` IDs.
- Allocation issue returns post-lock balances.
- Relay returns per-record results and settles valid transactions.
- Idempotent replay does not double-spend.
- Overspend, collision and duplicate nonce produce documented statuses.
- Sim reset works with admin secret.

### Gate C — Edge/PWA

- RoleGate selects Customer, Merchant and Gateway.
- Demo loop works with no backend.
- Live loop works with backend.
- Auth QR stays under 400 characters.
- Offline verifier rejects tampered amount, wrong merchant, wrong nonce, expired OAC and bad signatures.
- Paste-token fallback works on non-secure origin.
- IndexedDB state survives reload.

### Gate D — Visual

- Screenshots at 1440x900 and 390x844 comparable to kit.
- Design tokens match `DESIGN_SYSTEM.md`.
- Navigation switches at 1024px as documented.
- Sheets are bottom-anchored on mobile and centered on `sm:`+.
- QR targets are large and black-on-white.

### Gate E — Demonstration

- Three consecutive runs of the golden demo loop succeed.
- Every screen states that value is simulated.
- Reset works before each run.
- Startup instructions work from a clean clone.

## Online/offline deployment rehearsal

For real live testing on Nobus, follow `ONLINE_OFFLINE_TESTING.md`. It covers online registration, offline signing/acceptance, reconnection relay, service-worker caching and the sticky-demo gotcha when reloading while offline.

## Visual regression procedure

1. Start frontend dev server on the reference port.
2. Run `scripts/capture-screenshots.cjs` (or manual Playwright captures).
3. Compare generated screenshots to `screenshots/` using an image diff tool or side-by-side review.
4. Check layout, spacing, typography, colours, buttons, navigation, component sizes and overflow.
5. Record differences in a local `visual-diffs.md`; fix structural differences before pixel polish.

## Sign-off checklist

- [ ] Backend tests pass.
- [ ] Frontend tests pass.
- [ ] Both builds pass.
- [ ] Golden demo loop passes in demo mode.
- [ ] Golden demo loop passes in live mode.
- [ ] Visual comparison complete at desktop and mobile.
- [ ] No secrets in repository or docs.
- [ ] README startup instructions verified from clean clone.
- [ ] Freeze commit/tag created.
