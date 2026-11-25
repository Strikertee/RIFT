# UI Screen Inventory

## Application entry

`bank/src/main.tsx` mounts providers in order: `PrefsProvider` → `RoleProvider` → `BankProvider` → `ToastProvider` → `App`. `App` renders `RoleGate` when no role, a spinner while identity is loading, then CustomerApp, MerchantApp or GatewayApp.

There is no URL router; screens are state-driven.

## Screens and states

| Screen | Files | States captured | Screenshot pattern |
| --- | --- | --- | --- |
| RoleGate | `bank/src/rift/RoleGate.tsx` | Default; live/demo badge | `rolegate-<viewport>.png` |
| Customer Overview | `bank/src/screens/Home.tsx` | Boot skeleton, populated send/receive/lock sheets, receive card, history filter, service payment sheets | `customer-overview-<viewport>.png` |
| Customer RIFT | `bank/src/screens/Rift.tsx` | Empty, locked, lock error, unlock sheet, spend form, Auth QR, done | `customer-rift-empty-*`, `customer-rift-locked-*`, `spend-modal-form-*`, `auth-qr-*` |
| Customer Loans | `bank/src/screens/Loan.tsx` | Calculator, schedule sheet, accepted mock offer | Not in automated matrix; source describes states |
| Customer Profile | `bank/src/screens/Me.tsx` | Preferences, profile/security/help/about/reset sheets | Not in automated matrix; source describes states |
| Merchant Till | `bank/src/rift/MerchantApp.tsx` | Empty amount, invoice QR, raw token, scanner/paste, demo token, success receipt, error | `merchant-till-*`, `merchant-invoice-qr-*` |
| Merchant Receipts | `bank/src/rift/MerchantApp.tsx` | All/Pending/Settled filters, empty state, receipt list | `merchant-receipts-*` |
| Merchant Sync & relay | `bank/src/rift/MerchantApp.tsx` | Empty export notice, batch QR navigation, copy JSON, relay controls | `merchant-sync-*` |
| Gateway | `bank/src/rift/GatewayApp.tsx` | Queued/settled/rejected stats, ingest card, relay queue, batch chunks, settlement ledger, node monitor, light theme | `gateway-*`, `gateway-light-*` |
| Rehearsal Onboarding | `rehearsal/client/src/screens/Onboarding.tsx` | Role selection, form, API-not-configured notice | `client-onboarding-*` |
| Rehearsal Set PIN | `rehearsal/client/src/screens/SetPin.tsx` | One-time PIN setup | `client-set-pin-*` |
| Rehearsal Login | `rehearsal/client/src/screens/Login.tsx` | PIN login, masked phone/role | `client-login-*` |

## Important interaction states

- Role switch from header returns to RoleGate; role persists in localStorage.
- Theme toggle changes CSS variables and meta theme color.
- Hide balance masks `Money` components.
- Network pill reacts to `navigator.onLine`.
- Spend modal steps: `form` → `qr` → `done`.
- Merchant tabs: `Till` / `Receipts` / `Sync & relay`.
- Scanner disables camera on non-secure origins and shows an amber notice.
- Sheets animate from bottom on mobile, center on `sm:`+.

## Not captured automatically

Loans and Profile sheets, Home send/receive/history sheets, and loading skeleton frames were not captured in the matrix. They are fully described in `functionality/FEATURE_SPECIFICATIONS.md` and their source files. Capture them manually if visual parity for those secondary screens becomes critical.
