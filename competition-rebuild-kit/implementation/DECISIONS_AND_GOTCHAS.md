# Decisions and Gotchas

## Decisions

1. **Demo-first product UI.** `bank` falls back to a local issuer/core; `rehearsal/client` fails closed. Preserve both behaviours because they serve different purposes.
2. **Sticky demo fallback.** Avoid repeated failed health probes; reload or `resetModeCache()` re-probes.
3. **Automatic live registration.** Customer and merchant register when a role is chosen in live mode; gateway does not need a Core account.
4. **Identity rotation on conflict.** Registration retry rotates keypair, phone and merchant code rather than reusing a colliding identity.
5. **6-hour allocations.** Backend caps `duration_hours` at 24; wireframes show 6.
6. **Optical batch chunks.** Full batch JSON is ~2.6 KB, so chunks of 450 chars are used.
7. **Raw token under QR.** Enables two-phone transfer without camera on HTTP LAN origins.
8. **Canonical settled status.** `SETTLED (SIMULATED)`; legacy `SETTLED (SIMULATION)` is normalised only for old data.
9. **No router/state library.** React contexts and useState drive everything.
10. **No real money.** All settlement is simulated and labelled.

## Gotchas

### Crypto and signatures

- Use no-millisecond ISO timestamps. `Date.toISOString()` produces `.000Z` and breaks issuer signature verification.
- `transaction_id` uses no separators in the hash input and dashed UUID output; integration notes claiming colons are wrong.
- v2 QR stores the transaction ID as 16 raw bytes; decode must restore dashed UUID format to match Core.
- `deriveTransactionId` and canonical payloads must agree across TypeScript and Python.

### Browser

- `crypto.randomUUID()` is unavailable on HTTP LAN origins; use `crypto.getRandomValues()`.
- Camera requires `window.isSecureContext`; on `http://192.168.x.x` the scanner is disabled with no permission prompt.
- Vite dev proxy only exists in `vite dev`; `vite preview` does not proxy `/api`.
- `.trycloudflare.com` must be in `server.allowedHosts` or Vite returns 403 through a tunnel.
- Service worker `autoUpdate` can replace the old app immediately; expect cache invalidation during testing.

### QR and batching

- Auth QR v2 is 262 bytes / ~353 chars; keep under 400.
- Batch chunk format: `RB.<total>.<index>.<payload>`; one receipt JSON can be 2.6 KB.
- QR render sizes: invoice 220, auth 240, batch 256. Larger black-on-white targets improved scanning.
- Batch QR count is not fixed; compute from payload length.

### Backend

- Admin secret default is `rift-hackathon-ogun-2026`, different from the API spec example.
- `X-Idempotency-Key` and `X-RIFT-Client-Version` are sent but ignored; idempotency is by `transaction_id`.
- Relay returns HTTP 200 even for rejected records; inspect `results[]`.
- Only overspend rejections are persisted as transaction rows; others return 404 on status query.
- `CRYPTO_VALIDATED` and `PROVIDER_AUTHORISED (SIMULATION)` are transient.
- Expiry does not refund reserved funds.
- `sim/reset` leaves users/merchants and returns account count as `mock_users_reset`.
- Merchant ID resolution only accepts `mch_<uuid>` or bare UUID; a `usr_` prefix yields `UNKNOWN_MERCHANT`.
- Bare UUID and prefixed IDs are accepted as bearer tokens; this is a rehearsal shortcut, not secure auth.
- Dev issuer key is deterministic when `ENVIRONMENT != production`; production requires an explicit key.

### Database

- Checked-in `rift_dev.db` lacks `alembic_version`; use a fresh DB for migrations.
- SQLite ignores `with_for_update()` and by default does not enforce foreign keys.
- PostgreSQL will enforce `VARCHAR(n)` lengths; unbounded request strings can cause DB errors.
- `docker-entrypoint.sh` has CRLF line endings; normalize before Linux container builds.

### UI/state

- Two balance sources exist: BankContext localStorage and IndexedDB keystore; they can drift.
- `Reset demo data` does not clear IndexedDB protocol state.
- Merchant accept writes outbox and consumes invoice in two separate operations even though an atomic helper exists.
- Auto-relay effect depends only on `online`; manual relay is reliable after ingest.
- Gateway chunk state is keyed only on total and is not cleared on every error path.
- Merchant risk limit columns are not enforced.
- Several UI features are mock: send, bills, loans, analytics, profile fields, PIN/biometrics in bank.

## Things not to change casually

- Canonicalization and timestamp formatting.
- Status strings.
- Transaction ID derivation.
- Demo/live trust model distinction.
- Vite proxy and LAN-origin rewrite.
- Design tokens and component structure.
