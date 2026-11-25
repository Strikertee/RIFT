# UI Verification

## Reference assets

- `design/DESIGN_SYSTEM.md` — exact tokens and component rules.
- `design/UI_SCREEN_INVENTORY.md` — all screens and states.
- `design/RESPONSIVE_BEHAVIOUR.md` — breakpoints and layout transitions.
- `design/SCREENSHOT_INDEX.md` — every captured screenshot.
- `screenshots/` — visual reference.

## Procedure

1. Start the rebuilt frontend on the reference port.
2. Capture the same states and viewports listed in `SCREENSHOT_INDEX.md`.
3. Compare side by side at 1440x900 first, then 390x844.
4. Check in this order:
   - Overall background and card surfaces.
   - Header/sidebar/bottom nav placement.
   - Typography scale and number fonts.
   - Spacing and card radii.
   - Button colours and states.
   - Amber usage limited to RIFT.
   - QR size and contrast.
   - Sheet position and scrim.
   - Empty, loading, error and success states.
5. Log differences with severity: structural, spacing, colour or animation.
6. Fix structural differences first.

## Specific checks

- RoleGate: headline wraps as "One protocol. / Three terminals."; three cards; simulated-core badge.
- Customer Overview: balance count-up, RIFT offline split, quick services grid, cash-flow card, recent activity.
- Customer RIFT: amber hero, Ring progress, lock chips, allocation certificate, timeline.
- Merchant: header shows business name and truncated ID; Till keypad 3 columns; receipt outbox side panel at `lg`.
- Gateway: four stat tiles; ingest card; per-row SIG pill; settlement ledger; node monitor notice.
- Light theme: token swap only; no layout shifts.
- Scanner: secure-context notice and disabled camera on HTTP LAN.

## Automated capture

Use `scripts/capture-screenshots.cjs`. It writes to `screenshots/` relative to the kit folder, produces a machine-readable index under `screenshots/evidence/`, and records console errors. Use `scripts/capture-affected-states.cjs` for quick recapture of mobile/desktop merchant and gateway states.

## Acceptance

UI verification passes when every P0 screen has a comparable reference screenshot and no structural differences remain at 1440x900 or 390x844.
