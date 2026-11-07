# TradeRelayCity Design System

## 1. Atmosphere & Identity

TradeRelayCity feels like a modern ballpark control room: confident, legible, and lively at the edges while the trading workspace stays calm. The signature is an original open-city/candlestick mark, paired with vivid electric-blue score bands and bright red identity strokes over a warm ivory field. The identity is sports-inspired and original, with no MLB logo or claim of affiliation.

## 2. Color

### Palette

| Role | Token | Value | Usage |
|---|---|---:|---|
| Brand/navy | `--navy-950` | `#041E42` | Sidebar, primary text, dark controls |
| Brand/navy raised | `--navy-800` | `#0A3470` | Sidebar hover, secondary dark surfaces |
| Brand blue | `--blue-600` | `#2169F3` | Primary actions, active navigation, chart |
| Brand blue hover | `--blue-700` | `#1553D5` | Primary action hover |
| Brand burgundy | `--brand-burgundy` | `#77001D` | Restrained brand rule and identity details |
| Brand red | `--red-400` | `#FF4268` | Bright logo detail, separate from semantic loss color |
| Canvas | `--canvas` | `#F8F6F0` | Main page background |
| Surface | `--surface` | `#FFFFFF` | Panels, tables, menus |
| Cream | `--cream-100` | `#CDC3A8` | Identity details, quiet highlight |
| Text primary | `--text` | `#11223A` | Primary copy and numbers |
| Text muted | `--text-muted` | `#5E6B7D` | Supporting copy and labels |
| Border | `--border` | `#DFE4EC` | Panel and control boundaries |
| Positive | `--positive` | `#146C43` | Positive example values and confirmations |
| Negative | `--negative` | `#B42318` | Losses, errors, destructive actions |
| Warning | `--warning` | `#8A5200` | Stale, paused, or caution states |
| Focus | `--focus` | `#155EEF` | Visible keyboard outline on light surfaces |

Brand red and burgundy are not semantic loss colors. Simulation/sample information is always identified in text, not by color alone. Dark navigation uses white text and cream/blue focus rings. Interactive controls have visible boundaries.

## 3. Typography

Use Bebas Neue for the wordmark, page title, short panel titles and score-band labels. Use Roboto for body copy, forms and navigation. Both are loaded from the supplied Google Fonts stylesheet with system fallbacks. Numeric data uses tabular lining figures. Maximum two font families; no body copy below 14px.

| Level | Size / line height | Weight | Usage |
|---|---:|---:|---|
| Display | 44 / 48px | 700 | Landing or product identity |
| Page title | 36 / 40px desktop; 28 / 32px mobile | 700 | Current page |
| Section title | 20 / 26px | 700 | Panel headings |
| Metric | 30 / 36px desktop; 26 / 32px mobile | 700 | Financial values |
| Body | 15 / 23px | 400 | Main interface copy |
| Table | 14 / 20px | 450 | Dense values and rows |
| Metadata | 12 / 18px | 600 | Status, helper labels |

## 4. Spacing & Layout

Use a 4px base: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 and 80px. The desktop shell has a 248px fixed sidebar and a flexible workspace with 32px padding, a 12-column grid and 20px gaps; content max width is 1600px. At 1024–1279px use 24px page padding and a 220px sidebar. Below 1024px the sidebar becomes an overlay drawer. Below 640px use 16px page padding and stack all dashboard panels; tables scroll within their own region. Keep controls usable at 320 CSS px and allow zoom/reflow.

## 5. Components

### App shell and sidebar
- **Structure:** navigation landmark, original TradeRelayCity candlestick emblem, grouped links, account/security footer; sticky top bar in workspace.
- **Variants:** expanded desktop rail; mobile/tablet overlay drawer.
- **States:** current, hover, focus-visible, drawer open/closed.
- **Accessibility:** real links/buttons, `aria-current="page"`, labeled menu button, Escape closes the drawer, focus returns to trigger.
- **Motion:** drawer opacity and horizontal transform, 220ms; respect reduced motion.

### Account and mode bar
- **Structure:** account selector, DEMO/LIVE text badge, preview connection status, notification and profile controls.
- **States:** preview, selected menu item, open menu, focus; LIVE remains a distinct mode from connection health.
- **Accessibility:** named buttons, menu keyboard support, status includes visible text.
- **Motion:** menu opacity/transform, 160ms.

### Preview banner and status badge
- **Structure:** icon, concise heading, plain language explanation; text badge plus icon.
- **Variants:** informational preview, connected, offline, stale, paused, pending, error.
- **Accessibility:** status is not conveyed with color alone; sample data is explicitly labeled.
- **Motion:** no looping/pulsing; short opacity entrance only.

### Metric panel
- **Structure:** label, value, currency/unit, period context, illustrative marker.
- **States:** default, positive, negative, unavailable (`—`), stale.
- **Accessibility:** label/value relationship is read in order; signs accompany semantic color; tabular numerals.
- **Motion:** opacity and small transform on initial entry; no count-up of financial values.

### Chart panel
- **Structure:** title, selected range controls, SVG plot, readable axes, text description and sample-data caption.
- **States:** selected range, focus, unavailable; preview data only.
- **Accessibility:** keyboard buttons, `aria-pressed`, chart summary, SVG marked decorative when summary provides equivalent context.
- **Motion:** GSAP draws the line once on first mount; disabled for reduced motion. Do not animate live ticks.

### Positions table and activity list
- **Structure:** panel title and sample label, semantic table/list, clear columns and empty state.
- **States:** rows, empty, unavailable, horizontally scrollable table at narrow widths.
- **Accessibility:** table headers, numeric alignment, visible focus for row links, sign and semantic color for P&L.
- **Motion:** short opacity entrance; no feed auto-scroll.

### Trade history and evidence drawer
- **Structure:** persistent account/environment stamp, SIMULATED fixture banner, separate Executed trades and Attempts/blocks tabs, filter panel, bounded table, and a right-side evidence drawer.
- **Data hierarchy:** outcome/status leads; symbol, side, volume and timestamps identify the record; gross P&L, individual charges and net P&L stay separate. Confirmed facts, supported observations and hypotheses use separate headings. The active account currency is explicit, and mixed currencies are never combined.
- **States:** loading, offline/unavailable, filtered empty, list rows, outcome badges, drawer loading/error, unavailable price/chart/evidence, and no-lessons state.
- **Accessibility:** semantic table headers, tab roles and selected state, labeled filters, visible focus, 44px controls, scrollable table region on narrow layouts, dialog name/modal state, Escape and backdrop close, and text labels in addition to semantic colors.
- **Motion:** short drawer opacity/transform entrance only; no animated financial values; remove nonessential motion under reduced-motion preference.
- **Color:** reuse `--positive`/`--positive-bg`, `--negative`/`--negative-bg`, `--warning`, `--blue-100`, `--surface`, `--canvas`, `--border`, and text tokens. Brand red remains separate from loss semantics.

### Button and icon control
- **Variants:** primary, secondary, quiet, destructive; icon-only only when named.
- **States:** default, hover, pressed, focus-visible, disabled, unavailable with explanatory text.
- **Accessibility:** 44px minimum touch target, semantic elements, visible focus.
- **Motion:** color and transform only, 140ms; respect reduced motion.

### Empty/preview destination
- **Structure:** icon, destination heading, explanation that backend behavior is not connected.
- **States:** section preview, empty, unavailable.
- **Accessibility:** clear heading order and no fake success messages.
- **Motion:** 180ms opacity and small transform.

## 6. Motion & Interaction

Use Motion for React (`motion` package, imported from `motion/react`) for UI presence, menu, drawer and hover/tap transitions. Use GSAP only for the chart’s one-time SVG line reveal. Micro motion is 120–160ms, panel/menu motion 180–220ms, and initial content reveal 360–480ms. Animate transform and opacity; no layout animation on data surfaces, no pulsing prices or celebratory effects. Use `prefers-reduced-motion` to remove nonessential movement and show the finished chart immediately.

## 7. Depth & Surface

Use a restrained mixed strategy: fine cool borders for structure and soft short shadows (`0 8px 24px rgba(9, 27, 53, 0.06)`) for primary panels and menus only. The sidebar is a quiet navy surface with a subtle vertical tonal shift; the workspace remains warm and mostly flat. Avoid glass effects and layered cards.
