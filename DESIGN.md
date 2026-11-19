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

Below 1024px the floating navigation becomes a fixed, scrollable drawer with 16px inner gutters and full-width vertical destinations. The mobile header lets account context and MT5 status wrap instead of shrinking labels below readable size.

## 5. Components

### App shell and floating navigation
- Centered pill with Overview, Trading, History, Assistant; a labeled More menu preserves every secondary route.
- On mobile, a hamburger opens one vertical drawer containing every route. The drawer closes on selection, Escape, close button, or scrim press; focus returns to the hamburger and background scrolling stops while open. Closed drawer controls are removed from keyboard focus.
- On desktop the account selector, SIMULATED/DEMO/LIVE mode, connector health, last-update context, and theme toggle remain visible together. On mobile, the simulation banner carries mode context while the MT5 status has its own header row.
- The account selector shows the current account name and a text action, “Change account,” without icons. It remains a 44px minimum button with a visible expanded state.
- Current, hover, focus-visible, menu-open and theme states are distinct. Mode, connector health and strategy state never share one indicator.
- Buttons expose `aria-current`; menu and theme controls are keyboard operable and clearly named.
- The context row includes a labeled sign-out control; sign-out failures stay visible and do not imply the session ended.
- The desktop header shows a text-labeled Sign out button. On mobile, the same action is available in the navigation drawer with a visible label.
- The Windows connector has a Sign out and disconnect control. It stops scheduled sync and demo runs, revokes the paired device on the website, and clears its local device and MT5 credentials. If revocation cannot be confirmed, local activity stays stopped and the user can retry or revoke the device on the website.
- The Windows connector has an Open Trading page on website button. It opens the configured website's authenticated `/app/trading` route in the browser; sign-in returns the user to Trading. The button never submits an MT5 order.
- The MT5 MCP status is separate from simulation state and links to Accounts. It names unpaired, recently synced, offline, read error, paused, stale, checking, and unavailable states in text as well as color. A sync older than 45 seconds is unverified because the Windows connector normally syncs every 15 seconds; an old snapshot must not imply a current connection.

### Theme system
- Dark navy is the default. Light uses warm off-white and the same brand accents. Persist selection locally and apply it to auth, overview, history, assistant and shared surfaces.
- Both themes provide visible focus and readable positive, negative, warning, stale, offline, pending, loading, empty, denied, success and error states.

### Metric, chart and feature cards
- Featured metric surface is cream with navy text. Feature surface is burgundy with off-white text. Dark operational cards use raised navy.
- Use real account-scoped values only. Missing values display an em dash and explanation. Simulated fixtures are explicitly labeled and separate from broker data.
- Charts label period, currency and units and provide an accessible text alternative.

### Forms, tables, assistant and dialogs
- The Trading destination uses the shared navy panel, cream action, labeled inputs, and account selector for a DEMO-only strategy editor. AI drafts populate the same bounded fields; saved drafts need a separate Activate action. Active and draft states are shown in text, and connector arming remains local.
- Use shared themed surfaces, visible validation, 56px table rows, aligned columns, 14px content, compact pill filters and readable assistant message widths.
- On phones, the assistant workspace uses 16px outer corners in place of the desktop card radius.
- The assistant workspace grows with its conversations and messages so the page scrolls through the full content. The mobile conversation list has no separate scroll area.
- Preserve existing confirmation and approval flows for consequential controls.
- The workspace reads its server mode before loading simulation records. Hosted read-only workspaces open the MT5 assistant source; simulation controls are available only in local simulation mode. The hosted overview uses the account snapshot view.
- Both assistant sources expose an optional, labeled AI interpretation checkbox with provider disclosure. Only typed questions and symbol names go to the provider; answers use stored records. Pending, unavailable-provider, quota, and database errors remain visible with their server-provided explanation. Simulation replies remain labeled as fixtures.
- The Broker page separates paired devices from MT5 account snapshots. It shows a one-time pairing code in a clearly labeled copyable field, its expiry, revocation controls, and an account card with broker/server/login, DEMO or LIVE type, balance, equity, open positions, and observation time. Stale and disconnected states suppress any impression of current data; no trade control appears on this read-only page.

### Buttons, tabs and states
- Pill controls use at least 44px interactive targets with visible focus, hover, pressed, disabled, pending and error states.
- Empty and unavailable states explain the actual backend limitation. Do not show fake working actions or results.

## 6. Motion & Interaction
Use existing Motion and GSAP patterns. Transitions are short and state-based; financial values never count up or imply order success. Respect reduced motion. Do not delay acknowledgements or conceal stale data.
Navigation drawer motion uses transform and opacity over about 220ms. Menu and account popovers close on outside click and Escape. Active destinations retain a cream selection surface; hover, press, and keyboard focus remain distinct.

## 7. Depth & Texture
Use a faint non-interactive dot texture and restrained ambient tonal shifts over navy, never behind dense text. Separate panels with subtle borders and short shadows. Retain quiet chart axes, thin lines, round-ended bars and cream highlights. Burgundy remains a brand treatment, not a semantic loss color.

## 8. Public entry pages (landing and private access)

The supplied landing and login images are the visual contract for these pages. They use the existing self-hosted Inter and JetBrains Mono and the selected candlestick mark. A separate generated still-life asset supplies copper-lit, dimensional candlesticks without embedding page text or controls. The pages retain a dark appearance regardless of the workspace theme setting.

| Role | Token | Value | Usage |
|---|---|---|---|
| Public canvas | `--public-bg` | `#111216` | Landing and form base |
| Public canvas deep | `--public-deep` | `#0C0D11` | Form area and footer |
| Public text | `--public-ink` | `#F7F5F0` | Headings and controls |
| Public muted | `--public-muted` | `#D0D0D4` | Supporting copy |
| Public cream | `--public-cream` | `#D9C9A9` | Hero emphasis and closing surface |
| Public copper | `--public-copper` | `#BA7150` | Artwork atmosphere only |
| Public burgundy | `--public-burgundy` | `#77001D` | Closing link and preview accent |
| Public action | `--public-blue` | `#245BE8` | Primary CTA |
| Public action hover | `--public-blue-hover` | `#3770FF` | Hover state |
| Public focus | `--public-focus` | `#A9C2FF` | Keyboard outline |

The landing uses fluid `clamp(16px, 5vw, 80px)` gutters and no overall width cap. Its desktop hero is an asymmetric text and art split; its workflow row becomes a vertical editorial sequence on narrow screens. Display type scales from 44px on phones to about 80px on desktops. Local copy widths remain readable.

### Public wordmark
- **Structure:** Existing `BotifyMark` plus real TradeRelayCity text.
- **States:** Default, focus when linked. The mark remains decorative within the linked name.

### Public CTA and text link
- **Structure:** Real anchor with at least 44px target, arrow icon where shown.
- **States:** Default, hover, pressed, focus-visible. Blue fill is reserved for primary actions; secondary actions are underlined.
- The Windows connector download uses a distinct outlined secondary button beside sign-in. Its label names Windows and the nearby note states that the app is a read-only preview. The link points directly to a same-origin executable and requires no website session. The executable and Tk window use the existing candlestick mark as their icon.

### Illustration and preview panel
- **Structure:** Decorative still life image hidden from assistive technology; real HTML preview list layered above it.
- **States:** Static only. Preview rows are explicitly illustrative and do not imply a live connection.

### Private access form
- **Structure:** Full-height desktop split with an editorial image panel and a locally width-limited form panel. On mobile, the form takes priority and the art becomes a compact header. The form asks for username and password only.
- **States:** Password hidden/shown, validation error, service unavailable and pending. Inputs retain visible labels, autocomplete and paste. A server session cookie grants workspace access after successful sign-in; the Worker checks that session before serving `/app`.

### Public account and recovery forms
- Signup and recovery reuse the access split, self-hosted type, input scale, and focus styles. Signup asks for name, username, and password. No email field appears.
- After signup, eight one-time recovery codes appear in a copyable grid with a save acknowledgement before the primary sign-in action. Codes wrap at phone widths without causing page overflow. The same code pattern is used on the signed-in Security page when codes are rotated.
- Recovery asks for username, one code, and a new password. A used code invalidates previous sessions. Error and pending states use the existing access form treatments.
