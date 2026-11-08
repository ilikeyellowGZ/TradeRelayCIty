# TradeRelayCity progress

Updated: 2026-11-08

## Implemented

- React/TypeScript/Vite dashboard branded TradeRelayCity, responsive layout, user's Bebas Neue and Roboto fonts, vivid blue/red original candlestick mark, Motion interactions, GSAP entrance animation and reduced-motion handling.
- Cloudflare Vite Worker + Hono + D1 local simulation. Three isolated seeded users/accounts, fixture positions/events/decisions and command states. API ownership checks use account-scoped SQL and return 404 for foreign records.
- Owner-only Better Auth username/password sign-in mounted on three `/api/auth/*` paths; D1-backed session and rate-limit records; local hidden-prompt owner bootstrap. Public sign-up and all extra verification routes are inactive. Earlier passkey/invitation tables remain in historical migrations but have no active route.
- Local-only simulation API is guarded by `SIMULATION_MODE=true` and loopback host. Fixture account data, command transitions, deterministic HOLD-only mock AI decision route and per-user/owner request quota are implemented. A Python simulation client can atomically claim and acknowledge a HOLD fixture; it hard-requires loopback, only accepts HOLD, and reports `brokerAction: NONE`. No simulated route can create a broker order.
- Trade History is a local SIMULATED feature with separate executed/attempt views, versioned outcome and evidence read model, labeled cost/P&L fixtures, account-scoped list/detail/CSV routes, conservative explanations, and a responsive detail drawer. Broker history import and production auth remain unavailable.
- Provider adapter module contains bounded Groq chat structured-output requests for GPT OSS 20B and Qwen 3.8 27B, timeout/size checks and candidate-match validation. It is not connected to a production route and has not been called with credentials.
- Closed-bar ICT-inspired strategy evaluator and Decimal risk precheck. These generate candidate/permission results only. Live entry execution is hard-disabled.
- CSV M15/H1 backtest runner uses chronologically available closed bars, bounded retracement expiry, spread/slippage/commission price costs and adverse stop-first handling when one candle touches both levels. No market dataset or performance claim is included.
- Windows Python connector source uses the official MCP SDK, loopback endpoint validation, read-only tool allowlist, single-instance lock, SQLite intent journal and Windows Credential Manager interface. A PyInstaller app directory was built on Windows; it is not an installer and was not interactively launched.
- Deployment, architecture, API, strategy, credential/security, friend setup, Windows connector, cost and validation documents are present. Build cleanup removes staged `.dev.vars` from output.

## Tested

- TypeScript tests: 9 passed (simulation ownership/command states, mock HOLD, provider output downgrade and malformed response rejection).
- Windows connector Python `unittest`: 10 passed (MCP boundary, read-only allowlist, journal idempotency, risk sizing/limits, closed-bar swing rules, stop-first backtest handling, and simulation client loopback/persona guard).
- Local D1 migrations 0001â€“0004 applied successfully in the previous run. Three fixture personas, simulation quota ledger and Better Auth tables were present.
- Local Worker smoke checks previously verified `/api/health` reports `SIMULATED` / `isLive=false`, fixture ownership, foreign-account 404, unauthenticated Better Auth session response, invalid invite response, mock HOLD and zero-quota 429.
- Local end-to-end simulation smoke inserted one transient HOLD fixture, then the Python simulation client claimed and acknowledged it; result was `SIMULATION_ONLY_NO_BROKER_ACTION`, `SIMULATED`, `isLive=false`.
- Windows PyInstaller build succeeded with Python 3.14.5. Real credential storage operations have not been tested with a disposable key.
- `npm run build` succeeds after the latest source changes; Cloudflare Vite prints non-fatal upstream Zod annotation and auth-client chunk notices. Post-build check confirmed `dist/traderelaycity/.dev.vars` is absent.
- Trade History logic tests cover outcome classification, inclusive net/P&L mapping, weighted partial-fill aggregation, conservative missing-evidence wording, CSV formula neutralization/redaction, owner/account-bound query construction, and bounded pagination.
- Local D1 migration `0006_trade_history.sql` applied; repeated execution kept fixture IDs stable. Local API smoke checks verified owner list/detail/export and foreign-owner 404s. Browser smoke checks exercised both history views, detail drawer, filter/search, CSV download, timezone labeling and 375px layout with no document-level horizontal overflow.
- Latest verification: `npm test -- --run` passed 33 tests across 6 files; `npm run build` completed; repeated local application of migration `0006` preserved 7 owner trades + 5 owner attempts and one attempt per other demo owner. Chromium checks covered 1280/768/375px with no page errors or document-level horizontal overflow; `git diff --check` reported no whitespace errors.

## Unverified

- Full keyboard-only walkthrough, remote username/password sign-in, session expiry and Worker CPU budget.
- Real-provider adapter requests, provider schema compatibility by selected model, token reservation/reconciliation, actual spend tracking and provider outage handling.
- Backtest has only a stop-first mechanics test; no real market data was supplied. Dataset splits, contract costs, session/holiday filtering, and economic results remain unvalidated.
- MT5 MCP handshake/capability schemas, detected account identity, FxPro symbol contract specs, Windows Credential Manager, app runtime and friend installation.
- Cloud device pairing/revocation, connector cloud polling and command claiming, leases/fencing, connector-to-broker execution, uncertain submission reconciliation and protective management.
- Remote Cloudflare authentication, deployment, Worker CPU budget and actual D1 usage under three users.

## Externally needed later

- Your Cloudflare account, remote D1 database ID, chosen production origin/domain and remote owner password bootstrap.
- A Groq API key after the adapter is wired, tested and bounded by real provider usage controls. GPT OSS 20B is the default model; Qwen 3.8 27B is an optional preview model.
- Friend's Windows PC, MT5/FxPro demo terminal, local MCP address/key and permission to run read-only discovery followed by deliberate demo-only validation.
- Broker-confirmed exact symbol mappings, contract/tick values, sessions, commission and historical data for research.

## Next implementation work

1. Verify remote owner username/password login, sign-out and session expiry; define restricted password recovery before deployment.
2. Implement device pairing, revocable scoped credentials, cloud polling/claim leases, and end-to-end simulated connector flow.
3. Finish broker adapter interfaces and recovery/reconciliation tests while keeping live order calls disabled until demo checks pass.
4. Add authenticated real-provider routing with atomic usage reservations and provider cost/limit handling; keep simulation mock-only.
5. Add backtest dataset split/report metadata and validate on user-supplied broker data.
6. Complete responsive/keyboard and connector runtime QA; update deployment handover after external Cloudflare setup.

## 2026-11-08 visual redesign

- Reworked the application design contract around the AETHER/Variant-inspired layout adapted to TradeRelayCity branding: self-hosted Inter and JetBrains Mono, centered pill navigation, navy dark theme, warm light theme, cream account metric, burgundy risk feature panel, and large rounded surfaces.
- Added a persistent Light/Dark theme switch (dark is the default), reused existing account-scoped overview values and chart/risk components, added direct History and Assistant actions, and retained all existing destinations in the navigation More menu.
- Updated auth, assistant, history and shared surface styling through common theme tokens. Added font package SIL Open Font License notices under `docs/licenses/`.
- Verification run: `npm run build` passed; `npm test -- --run` passed (33 tests across 6 files); `git diff --check` passed after removing one trailing blank line.
- Browser interaction and screenshot checks at 320, 390, 768, 1024 and 1440 were not completed: the computer-use browser host was unavailable, and this repo does not include Playwright. Account switching, History filtering and Assistant access therefore remain unverified in this redesign session. No backend routes, trading permissions, API contracts or execution safeguards were changed.
- Follow-up sizing adjustment: removed the 1200px content cap, switched to fluid desktop gutters, and enlarged desktop navigation, account context, display headline, metric values, panel headings and table rows while preserving compact tablet/mobile scales.
- Fixed mobile navigation compression and dropdown clipping: the compact capsule now shows the four primary destinations plus More without making the capsule a horizontal clipping scroller; the More menu remains vertically scrollable on short screens. Primary icon controls now have explicit accessible names.
- Follow-up verification: `npm run build` passed, `npm test -- --run` passed (33 tests across 6 files). Browser visual verification remains unavailable because the CUA browser host could not attach.
- Updated the dark theme canvas from navy to neutral charcoal (`#1F2024`), with a restrained grey ambient highlight; light theme remains off-white.
- Removed the second rounded topbar panel so the account/context controls no longer read as a duplicate navigation bar; account switching, mode, connector health and theme controls remain available in an unboxed context row.

## 2026-11-08 public landing and private access frontend

- Added a real public landing page at `/` with the selected repository mark, anchored workflow, illustrative status panel, fluid layout and original copper-lit candlestick artwork. The artwork is an image asset only; all copy, links, status rows and controls are HTML.
- Added the matching split-screen private access page at `/login`, with password visibility, accessible validation, recovery guidance and a prepared six-digit authenticator component. The login page does not transmit the password or create a session because the requested custom password/challenge/TOTP backend contract is absent.
- Route mapping: `/` is public; `/login` is the password page; `/login/verify` and `/login/enroll` return to password entry because no validated server challenge exists; `/app` and `/app/*` return to login without mounting the dashboard; the legacy `/enroll` path returns to login. There is no return-path parameter or browser-stored auth token in this frontend flow.
- Existing dashboard, history, assistant and local simulation code remain in `src/App.tsx` but are unreachable through the public router until a verified session contract is implemented. The existing loopback `/api/simulation/*` API remains separately governed by its `SIMULATION_MODE` and loopback restrictions; React routing is not an API security boundary.
- Frontend files: `DESIGN.md`, `index.html`, `public/images/candlestick-still-life.webp`, `src/main.tsx`, `src/App.tsx`, `src/EntryRouter.tsx`, `src/public/PublicBrand.tsx`, `src/public/LandingPage.tsx`, `src/public/PrivateAccessPage.tsx`, `src/public/public.css`. Browser QA artifacts were removed from the repository and `.playwright-cli/` was ignored.
- Checks: `npm test` passed 33 tests across 6 files; `npm run build` passed; `npx react-doctor@latest --verbose --scope changed` found no new issue in its changed-file scan. Local route and artwork HTTP responses were 200. Playwright in Edge confirmed landing and login rendering, the workflow anchor, header sign-in navigation, field error/visibility/recovery states, `/app` redirect without `.app-shell`, `/login/verify` expiry redirect, and no document-level horizontal overflow at 320, 390, 768, 1024 and 1440px. The computer-use browser host was unavailable, so the installed Playwright CLI was used.
- Pending: the owner backend must define and implement password challenge, server-approved challenge persistence and expiry, authenticator verification, verified session check, sign-out, and restricted recovery using same-origin secure cookies. Then connect these components to that contract and test successful and failed credentials, replay/expiry, refresh, session expiry and protected API denial. Current shared-tree Supabase Auth work is separate and conflicts with this brief's explicit custom-auth decision; it has not been wired into this frontend.

## 2026-11-08 market scope clarification

- The owner clarified that TradeRelayCity covers forex currency pairs and cryptocurrencies. EURUSD remains the initial strategy example; the existing broker execution path is still disabled. Exact crypto availability, symbol names, contract specifications, pricing precision and sessions require broker verification before execution.
- Updated `BUILD_BRIEF.md`, `README.md`, `docs/strategy.md` and landing copy to state the scope. Kept the original `TradeRelayCity_Codex_Build_Prompt.md` unchanged as the supplied source brief.
- Replaced gold simulation positions with AUDUSD and gold rejected attempts with BTCUSD in the in-memory fixtures, trade history display configuration and new `migrations/0007_currency_pair_fixtures.sql`. The migration changes only named `SIMULATED` fixture rows in existing local databases; it does not edit broker records or enable new trading. The original seed migrations remain as historical migration files.
- Verification: `npm test` passed 35 tests across 7 files; `npm run build` and `git diff --check` passed. An in-memory SQLite run of migrations 0001, 0006 and 0007 confirmed the resulting AUDUSD positions, BTCUSD rejected commands and corrected history. A production preview screenshot at 320px showed the updated landing copy wrapping without visible clipping. No real broker symbol or crypto contract was verified.

## 2026-11-08 Groq provider selection

- Replaced the unused OpenAI/Anthropic/xAI adapter with Groq chat completions, strict JSON schema output, and an explicit model allowlist: `openai/gpt-oss-20b` (default) or `qwen/qwen3.8-27b` (preview). The requested Qwen name was interpreted as Groq's currently listed Qwen 3.8 27B model.
- The adapter requires `AI_PROVIDER=groq` and `GROQ_API_KEY`. It remains disconnected from the production API until authentication, quota reservation and cost handling are in place. Simulation continues to return deterministic HOLD without a provider call.
- Verification: `npm test -- --run` passed 37 tests across 7 files; `npm run build` and `git diff --check` passed. Build cleanup left `dist/traderelaycity/.dev.vars` absent. No Groq credential was added or used.

## 2026-11-08 owner username/password entry

- Kept the public landing page and its Sign in links to `/login`. The login form now asks only for username and password and uses Better Auth's username plugin with D1 session cookies. A verified session opens `/app`; a direct unauthenticated visit redirects to `/login`; a visible sign-out control clears the session.
- Removed the active passkey, invitation, Supabase owner route, authenticator and public sign-up paths. Earlier schema tables remain for migration history but are not reachable through the website API. Added database-backed sign-in rate limiting and migration `0008_owner_username_password.sql` from the generated Better Auth schema delta.
- The owner username is `iluvpistachioos`. `scripts/bootstrap-owner-password.ps1` prompts locally for the password, hashes it with Better Auth and creates the sole owner record. The password is never written to `.dev.vars`.
- Local checks: `npm test` passed 42 tests across 7 files; `npm run build` passed; migration 0008 applied. A temporary test owner passed correct-password sign-in, wrong-password rejection, public sign-up denial, session lookup and sign-out. Playwright in Edge confirmed landing Sign in navigation, the two-field login page, unauthenticated `/app` redirect, authenticated workspace load and sign-out. Mobile 375px and desktop 1280px login screenshots had no horizontal overflow. The temporary owner was removed; no owner password has been chosen yet.
- Still pending: your local owner password setup, remote Cloudflare/D1 configuration, remote sign-in and Worker CPU validation, password recovery design, and real MT5 connection/pairing. The current connector remains read-only and live trading remains disabled.
