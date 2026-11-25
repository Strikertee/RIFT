# Business Logic

## Canonical serialization

Both TypeScript and Python sort object keys lexicographically and serialize with zero whitespace:

```ts
JSON.stringify(sortedObject)
```

```python
json.dumps(payload, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
```

This is a pragmatic RFC 8785 subset valid for the current string/integer payloads. Full float canonicalization is not implemented.

## OAC signing

Canonical OAC fields: `allocated_amount_kobo`, `currency`, `customer_id`, `customer_pubkey_hex`, `expires_at`, `issued_at`, `issuer_key_version`, `oac_id`.

Issuer signs with Ed25519. Timestamps must be no-millisecond ISO `YYYY-MM-DDTHH:MM:SSZ`; `Date.toISOString()` breaks signatures.

## Transaction signing

Canonical transaction fields: `amount_kobo`, `currency`, `customer_timestamp` (integer epoch), `invoice_nonce`, `merchant_id`, `oac_id`, `seq_no`.

`transaction_id = "tx_" + UUID-like(SHA256(oac_id || seq_no || invoice_nonce)[0:32])`. No separators between inputs. Backend recomputes this and rejects mismatches.

## QR formats

- Invoice: compact JSON `{t:'INV',m,a,c,n,ts}`.
- Auth v2: `R2.` + unpadded base64url of a 262-byte big-endian payload; ~353 chars.
- Auth v1 legacy JSON is decoded but not emitted.
- Batch chunk: `RB.<total>.<index>.<payload>`, 450-char payload chunks.

## Offline verification order

1. Shape checks (hex lengths, positive integers).
2. Reconstruct canonical OAC and verify issuer signature.
3. Check OAC expiry.
4. Compare merchant, amount and nonce to invoice.
5. Derive transaction ID and compare.
6. Check amount ≤ OAC allocation.
7. Allow max +300s customer clock skew.
8. Verify customer signature.

## Core ingestion and settlement

- Each transaction is processed in its own DB transaction.
- Existing transaction ID → idempotent replay.
- Duplicate `(oac_id, seq_no)` → `QUARANTINED_COLLISION`.
- Duplicate `(merchant_id, invoice_nonce)` → `REJECTED_DUPLICATE`.
- Overspend → `REJECTED_OVERSPEND`; this is the only rejected row persisted.
- Valid transaction → `CRYPTO_VALIDATED` → increment allocation spend, decrement customer reserved, credit merchant → `PROVIDER_AUTHORISED (SIMULATION)` → `SETTLED (SIMULATED)`.
- Audit events record provider authorisation, settlement, rejection and collisions.

## Ledger invariants

- Issuance: `available -= amount`, `reserved += amount`.
- Settlement: `allocation.spent += amount`, `customer.reserved -= amount`, `merchant.available += amount`.
- `spent <= allocated` must always hold.
- Expiry does not refund reserved funds.
- `REVOKED` exists in the enum but no code path sets it.

## Demo mode

- Demo issuer keypair and simulated core live in localStorage.
- Demo relay re-verifies locally and applies the same anti-replay/overspend checks against a local ledger.
- Demo settlement reference format: `SIM-<base36 timestamp>`.
- Demo fallback is sticky until reload or `resetModeCache()`.

## Balance reconciliation

- Client reconciliation only increases local spend; it never decreases it.
- Bank patches identity balances from `issueAllocation` and `getAllocationStatus` responses.
- Two balance stores exist: BankContext localStorage and IndexedDB keystore; sync is best-effort and can drift.
