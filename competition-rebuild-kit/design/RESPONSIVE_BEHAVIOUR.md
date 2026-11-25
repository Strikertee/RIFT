# Responsive Behaviour

## Breakpoints

The application uses Tailwind's default breakpoints. Only `sm:` (640px) and `lg:` (1024px) materially affect layout. There are no custom media queries except `prefers-reduced-motion`.

## Layout transitions

| Width | Navigation | Sheets / modals | Content |
| --- | --- | --- | --- |
| <640px | Header logo + icon buttons; BottomNav fixed dock visible; Sidebar hidden | Bottom sheet anchored to viewport bottom, rounded top corners, max-height 90vh | Single column; balances and cards stack; charts shrink |
| 640–1023px | Still BottomNav; Sidebar hidden | Centered dialog with padding and max-width `md` | Cards may use wider padding; two-column grids begin where specified |
| ≥1024px | Left Sidebar visible with nav, allocation meter and account footer; BottomNav hidden | Centered dialog | Customer Home uses multi-column grid; merchant uses 5-column till layout with main panel and side takings/outbox |

## Specific observations

- Customer Overview: at mobile the balance hero, quick services, cash flow, spending mix and activity stack vertically; at desktop the main content sits beside the sidebar and uses a wider grid.
- Merchant Till: at `lg` the invoice/keypad panel occupies 3 of 5 columns and takings/outbox occupy the rest; below `lg` everything stacks.
- QR codes: invoice QR 220px, Auth QR 240px, batch QR 256px; raw token text wraps beneath on narrow screens.
- Merchant keypad uses a 3-column grid at all sizes.
- Gateway stats use four tiles; on narrow screens they wrap.
- `Sheet` closes on Escape and locks body scroll.

## Viewport matrix captured

| Category | Viewports |
| --- | --- |
| Mobile | 360x800, 375x812, 390x844, 412x915 |
| Tablet | 768x1024, 1024x768 |
| Laptop / desktop | 1280x800, 1440x900, 1920x1080 |
| Mobile landscape | Not captured; use 412x915 rotate as a manual check |

## Verification notes

- At 360px the merchant keypad remains usable; labels stay legible.
- At 390px the spend Auth QR sheet fills most of the viewport; raw token text scrolls within the sheet.
- At 1024px the sidebar appears and the merchant till switches to the two-column layout.
- At 1440px and 1920px cards keep a centered max width rather than stretching edge-to-edge.
- Modal close must be performed via Escape in automation; clicking the scrim can be intercepted by QR content.

## Rebuild rule

Reproduce the component structure and breakpoints first; exact pixel spacing should then be compared against the screenshots rather than guessed.
