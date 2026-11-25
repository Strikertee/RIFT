# Design System

The rebuilding agent must reproduce this system rather than invent a new one. Source: `bank/src/index.css`, `bank/tailwind.config.js`, `bank/src/components/ui.tsx`, `bank/src/components/AppShell.tsx`, and the screenshots.

## Theme and colours

Dark theme is the default. Variables are RGB triplets consumed as `rgb(var(--x) / <alpha>)`.

| Token | Dark | Light | Usage |
| --- | --- | --- | --- |
| `--bg` | 10 15 13 | 243 241 234 | App background |
| `--surface` | 17 25 21 | 255 255 255 | Cards |
| `--raised` | 23 33 28 | 250 248 243 | Inputs/buttons |
| `--overlay` | 28 40 34 | 255 255 255 | Hover surfaces |
| `--line` | 37 51 44 | 226 222 210 | Borders |
| `--line-strong` | 55 74 64 | 199 193 178 | Strong borders |
| `--text` | 236 244 238 | 20 32 26 | Primary text |
| `--text-2` | 154 172 160 | 90 106 97 | Secondary text |
| `--text-3` | 106 122 112 | 112 124 116 | Faint text |
| `--brand` | 48 209 88 | 13 122 74 | Primary brand |
| `--brand-deep` | 14 61 42 | 11 61 40 | Brand dark |
| `--brand-soft` | 22 52 36 | 223 241 230 | Brand tint |
| `--rift` | 255 178 36 | 245 165 36 | RIFT accent |
| `--rift-fg` | 255 178 36 | 180 83 9 | RIFT text |
| `--rift-soft` | 56 42 16 | 253 236 200 | RIFT tint |
| `--danger` | 255 99 99 | 211 64 64 | Errors |
| `--info` | 76 195 255 | 2 132 199 | Info |

Chart colours: violet `167 139 250`, magenta `244 113 181`, cyan `34 211 238`, lime `163 230 53` (dark); light theme uses darker variants.

Hero gradients use `--hero-a/b/c` deep greens. Manifest theme colour is `#0A0F0D` in both themes (light theme meta is updated to `#F3F1EA` at runtime).

The older README tokens `#103B2E`, `#F7F3EA`, `#F5A524` are approximate marketing tokens, not the actual CSS variables. Use the CSS variables above.

## Typography

- Body: `"Manrope Variable", Manrope, ui-sans-serif, system-ui, "Segoe UI", sans-serif`.
- Display/numbers: `"Space Grotesk Variable", "Space Grotesk", ui-sans-serif, system-ui, sans-serif`.
- `.num` applies Space Grotesk, `font-feature-settings: 'tnum' 1`, letter-spacing `-0.015em`.
- Common scale: 9–11px uppercase labels, 12px body, 15px display headings, 20–26px section headings, 2.3–2.55rem balance/hero amounts.

## Spacing, radii, shadows

- Border radii extended: `2xl = 1.25rem`, `3xl = 1.625rem`, `4xl = 2rem`.
- `.card`: `rounded-3xl border border-line bg-surface p-5 shadow-card`.
- `.input-shell`: rounded 2xl, border line, raised bg, focus border brand/60 and ring brand/20.
- Shadows: `card`, `hero`, `rift`, `dock` mapped to CSS variables.
- Background has animated radial glows and an SVG grain overlay.

## Components

`src/components/ui.tsx`:

- `Button` variants: primary, secondary, ghost, rift, danger; sizes sm/md/lg; plays tap sound.
- `IconBtn`, `Field`, `TextInput`, `Notice` (info/error/success/rift), `Switch`, `Segmented`, `Chip`.
- `Money` respects hide-balance preference and count-up animation.
- `Sheet` is a bottom sheet on mobile and centered dialog on `sm:`+, with Escape close and 190ms exit delay.
- `ToastProvider` keeps max 3 toasts, auto-leaves after 3s.
- `Skeleton`, `EmptyState`, `Avatar`.

`src/components/AppShell.tsx`:

- `Logo` (green bolt tile), `Wordmark` (Devions + BANK), `NetworkPill` (Online/Offline with pulse), `Background`, `Header`, `Sidebar`.
- Sidebar visible from `lg:`; BottomNav visible below `lg:`.

`src/components/charts.tsx`: `CashflowChart`, `Donut`, `Ring`.

## Animation

Keyframes: `rise`, `pop-in`, `sheet-up/down`, `fade-in/out`, `toast-in`, `shimmer`, `draw-line`, `pulse-dot`, `pulse-dot-rift`, `scan-line`, `drift`.

- `.anim-rise` 0.55s cubic-bezier(0.22,1,0.36,1).
- `.anim-pop` 0.45s spring; spring timing `cubic-bezier(0.34,1.4,0.44,1)`.
- `.anim-fade` 0.3s; sheets open 0.32s / close 0.2s.
- `prefers-reduced-motion` collapses all durations to 0.01ms.

## Visual rules for rebuild

- Keep the dark first, calm green/amber palette.
- Use large rounded cards, subtle borders and layered shadows, not flat Bootstrap-style panels.
- Use amber only for RIFT actions and highlights; green for primary banking actions and success.
- QR screens must render large black-on-white QR codes plus raw token text.
- Never substitute a generic admin template; match the screenshots.
