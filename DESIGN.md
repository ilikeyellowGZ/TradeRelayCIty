# TradeRelayCity Design System

## 1. Atmosphere & Identity
TradeRelayCity is a focused market control room. Its visual signature is a neutral charcoal dark canvas, floating navigation capsule, warm cream featured metrics, and an alternating burgundy feature surface. The warm light theme uses the same brand colors on a paper-like off-white canvas. The identity is original and makes no MLB affiliation claim.

## 2. Color

| Role | Token | Value | Usage |
|---|---|---|---|
| Brand navy | `--navy-950` | `#041E42` | Identity and light-theme text |
| Dark canvas | `--canvas` | `#1F2024` | Neutral charcoal app background in dark mode |
| Raised navy | `--navy-800` | `#0B2A50` | Dark-theme cards |
| Nested navy | `--navy-700` | `#12365D` | Dark-theme nested surfaces |
| Brand burgundy | `--brand-burgundy` | `#77001D` | Feature card, identity details |
| Brand cream | `--cream-100` | `#CDC3A8` | Featured metric, active tab, chart highlight |
| Off-white | `--off-white` | `#F7F5F0` | Dark-theme primary text, light canvas |
| Light muted | `--light-muted` | `#526174` | Text on cream/white surfaces |
| Dark muted | `--dark-muted` | `#A9B6C6` | Supporting text on navy |
| Positive light/dark | `--positive-light` / `--positive-dark` | `#146C43` / `#6FCF97` | Positive values by theme |
| Negative light/dark | `--negative-light` / `--negative-dark` | `#B42318` / `#FF8A84` | Losses and errors by theme |
| Warning light/dark | `--warning-light` / `--warning-dark` | `#8A5200` / `#F1C36E` | Warnings by theme |

Dark supporting surfaces use `#0B2A50` and `#12365D`; subtle navy borders use cream at 16%. The light canvas is `#F7F5F0`, panels are white, and supporting text is `#526174`. Burgundy is not a loss indicator. Mode and connector state are separate.

## 3. Typography
Self-host Inter Variable for all interface text, headings, controls, tables and financial metrics. Self-host JetBrains Mono for technical IDs, timestamps and compact diagnostic values only. Financial values use tabular numerals and may wrap or scale. No remote font service is required.

| Level | Size / line height | Weight | Usage |
|---|---:|---:|---|
| Overview display | Fluid 48–128 desktop / 48–76 tablet; 40–48 phone | 800 | Three-line overview headline, -0.05em tracking |
| Page title | 32–40 / 1.1 | 700 | Working pages |
| Section title | 20–24 / 1.25 | 600–700 | Panels |
| Metric | 64 / 1.0 featured; 42 / 1.1 secondary | 600–700 | Financial metrics |
| Body | 16 / 1.6 | 400 | Main copy |
| Controls and table | 14 / 1.4 | 400–600 | Interactive and dense data |
| Metadata | 12 / 1.5 | 500–600 | Labels and status |

## 4. Spacing & Layout
Use a 4px base scale. Use the full available desktop width with fluid 4vw side gutters (clamped between 24px and 72px) and a 12-column grid with 24px gaps. At tablet widths use 24px gutters; at phone widths use 16px. The floating navigation sits centered 40px from the desktop top edge. The overview uses an 8/4 hero split and a 7/5 chart/feature split. Stack panels when they no longer fit. Outer cards use 32px rounding and padding; nested charts use 20px rounding. Controls have at least 44px targets. Tables scroll inside a labeled region. Prevent page-level horizontal overflow at 320px.

## 5. Components

### App shell and floating navigation
- Centered pill with Overview, Trading, History, Assistant; a labeled More menu preserves every secondary route.
- Account selector, SIMULATED/DEMO/LIVE mode, connector health, last-update context and theme toggle remain visible together.
- Current, hover, focus-visible, menu-open and theme states are distinct. Mode, connector health and strategy state never share one indicator.
- Buttons expose `aria-current`; menu and theme controls are keyboard operable and clearly named.

### Theme system
- Dark navy is the default. Light uses warm off-white and the same brand accents. Persist selection locally and apply it to auth, overview, history, assistant and shared surfaces.
- Both themes provide visible focus and readable positive, negative, warning, stale, offline, pending, loading, empty, denied, success and error states.

### Metric, chart and feature cards
- Featured metric surface is cream with navy text. Feature surface is burgundy with off-white text. Dark operational cards use raised navy.
- Use real account-scoped values only. Missing values display an em dash and explanation. Simulated fixtures are explicitly labeled and separate from broker data.
- Charts label period, currency and units and provide an accessible text alternative.

### Forms, tables, assistant and dialogs
- Use shared themed surfaces, visible validation, 56px table rows, aligned columns, 14px content, compact pill filters and readable assistant message widths.
- Preserve existing confirmation and approval flows for consequential controls.

### Buttons, tabs and states
- Pill controls use at least 44px interactive targets with visible focus, hover, pressed, disabled, pending and error states.
- Empty and unavailable states explain the actual backend limitation. Do not show fake working actions or results.

## 6. Motion & Interaction
Use existing Motion and GSAP patterns. Transitions are short and state-based; financial values never count up or imply order success. Respect reduced motion. Do not delay acknowledgements or conceal stale data.

## 7. Depth & Texture
Use a faint non-interactive dot texture and restrained ambient tonal shifts over navy, never behind dense text. Separate panels with subtle borders and short shadows. Retain quiet chart axes, thin lines, round-ended bars and cream highlights. Burgundy remains a brand treatment, not a semantic loss color.
