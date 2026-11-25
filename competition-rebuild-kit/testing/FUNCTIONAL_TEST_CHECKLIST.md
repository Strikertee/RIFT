# Functional Test Checklist

Each row: initial state → action → expected result → pass/fail.

## P0 flows

| # | Initial state | Action | Expected result |
| --- | --- | --- | --- |
| 1 | App open, no role | Choose Customer | Overview renders; role persisted |
| 2 | Customer, no OAC | Lock ₦10,000 | READY offline balance; OAC card shown |
| 3 | Customer, OAC | Spend demo ₦2,000 | Auth QR with `tx_` ID and raw token |
| 4 | Merchant | Create ₦2,000 invoice | Invoice QR and nonce shown |
| 5 | Merchant with invoice | Paste matching auth token | Green receipt; outbox row PENDING_RELAY |
| 6 | Merchant/Gateway online | Relay batch | Result status `SETTLED (SIMULATED)` |
| 7 | Customer | Reconcile | Spend counter reflects relay |
| 8 | Backend down | Open bank | Demo badge and fallback notice |
| 9 | Backend up, fresh identity | Open bank | Live badge after health |
| 10 | HTTP LAN origin | Open Scanner | Camera disabled; paste fallback visible |

## P0 backend

| # | Initial state | Action | Expected result |
| --- | --- | --- | --- |
| 11 | Fresh DB | GET /health | issuer_key_loaded true in non-test env |
| 12 | Fresh DB | Register customer | 201 with `usr_` ID and mock balance |
| 13 | Customer registered | Issue ₦10,000 OAC | 201, balances 4,900,000 / 100,000 from 5,000,000 |
| 14 | OAC | Relay valid transaction | 200 results SETTLED (SIMULATED) |
| 15 | Same transaction | Relay again | IDEMPOTENT_REPLAY, no double credit |
| 16 | OAC spent | Relay larger amount | REJECTED_OVERSPEND |
| 17 | OAC seq reused | Relay second tx with same seq | QUARANTINED_COLLISION |
| 18 | Merchant nonce reused | Relay duplicate nonce | REJECTED_DUPLICATE |
| 19 | No admin secret | POST /sim/reset | 403 |
| 20 | Admin secret | POST /sim/reset | ledger_reseeded |

## P1 flows

| # | Action | Expected result |
| --- | --- | --- |
| 21 | Export pending batch | Numbered `RB.` QR chunks with Previous/Next |
| 22 | Ingest all chunks out of order | Full batch assembled and queued |
| 23 | Gateway relay selected | Only selected IDs relayed |
| 24 | Toggle light theme | Tokens change, layout unchanged |
| 25 | Hide balances | Money components masked |
| 26 | Switch role after lock | State persists; role gate shown then merchant/gateway loads |
| 27 | Reload app | Roles, preferences, OAC and outbox recovered |
| 28 | Reset demo data | Bank state reset; note IndexedDB protocol state may remain in reference |

## P2 flows

| # | Action | Expected result |
| --- | --- | --- |
| 29 | Send money demo | Success sheet with local reference |
| 30 | Receive | Account number copy/share |
| 31 | Bill payment | Reference and amount validated; demo success |
| 32 | Loan calculator | Monthly/total/interest update with slider and term |
| 33 | Profile sheets | Read-only seeded identity, preferences persist |
| 34 | Help accordion | Four FAQ items expand/collapse |

## Recording results

Use columns: Initial state, Action, Expected, Actual, Pass/Fail, Evidence path, Notes. Do not mark Pass without a command result or screenshot.
