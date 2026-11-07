# TradeRelayCity progress

Updated: 2026-11-07

## Implemented

- React/TypeScript/Vite dashboard branded TradeRelayCity, responsive layout, user's Bebas Neue and Roboto fonts, vivid blue/red original candlestick mark, Motion interactions, GSAP entrance animation and reduced-motion handling.
- Cloudflare Vite Worker + Hono + D1 local simulation. Three isolated seeded users/accounts, fixture positions/events/decisions and command states. API ownership checks use account-scoped SQL and return 404 for foreign records.
- Better Auth passkey plugin mounted on `/api/auth/*`; official CLI-generated D1 auth schema; one-time hashed invite records, owner bootstrap script, invite validation and enrollment UI. Physical WebAuthn and recovery/revocation flows are not verified/complete.
- Local-only simulation API is guarded by `SIMULATION_MODE=true` and loopback host. Fixture account data, command transitions, deterministic HOLD-only mock AI decision route and per-user/owner request quota are implemented. A Python simulation client can atomically claim and acknowledge a HOLD fixture; it hard-requires loopback, only accepts HOLD, and reports `brokerAction: NONE`. No simulated route can create a broker order.
- Provider adapter module contains bounded OpenAI Responses, Anthropic Messages and xAI chat structured-output request implementations, timeout/size checks and candidate-match validation. It is not connected to a production route and has not been called with credentials.
- Closed-bar ICT-inspired strategy evaluator and Decimal risk precheck. These generate candidate/permission results only. Live entry execution is hard-disabled.
- CSV M15/H1 backtest runner uses chronologically available closed bars, bounded retracement expiry, spread/slippage/commission price costs and adverse stop-first handling when one candle touches both levels. No market dataset or performance claim is included.
- Windows Python connector source uses the official MCP SDK, loopback endpoint validation, read-only tool allowlist, single-instance lock, SQLite intent journal and Windows Credential Manager interface. A PyInstaller app directory was built on Windows; it is not an installer and was not interactively launched.
- Deployment, architecture, API, strategy, credential/security, friend setup, Windows connector, cost and validation documents are present. Build cleanup removes staged `.dev.vars` from output.

## Tested

- TypeScript tests: 9 passed (simulation ownership/command states, mock HOLD, provider output downgrade and malformed response rejection).
- Windows connector Python `unittest`: 10 passed (MCP boundary, read-only allowlist, journal idempotency, risk sizing/limits, closed-bar swing rules, stop-first backtest handling, and simulation client loopback/persona guard).
- Local D1 migrations 0001–0004 applied successfully in the previous run. Three fixture personas, simulation quota ledger and Better Auth tables were present.
- Local Worker smoke checks previously verified `/api/health` reports `SIMULATED` / `isLive=false`, fixture ownership, foreign-account 404, unauthenticated Better Auth session response, invalid invite response, mock HOLD and zero-quota 429.
- Local end-to-end simulation smoke inserted one transient HOLD fixture, then the Python simulation client claimed and acknowledged it; result was `SIMULATION_ONLY_NO_BROKER_ACTION`, `SIMULATED`, `isLive=false`.
- Windows PyInstaller build succeeded with Python 3.14.5. Real credential storage operations have not been tested with a disposable key.
- `npm run build` succeeds after the latest source changes; Cloudflare Vite prints non-fatal upstream Zod annotation and auth-client chunk notices. Post-build check confirmed `dist/traderelaycity/.dev.vars` is absent.

## Unverified

- Browser visual QA at 320/768/1280 widths, keyboard-only walkthrough, passkey invitation/sign-in, owner invite creation and session revocation.
- Real-provider adapter requests, provider schema compatibility by selected model, token reservation/reconciliation, actual spend tracking and provider outage handling.
- Backtest has only a stop-first mechanics test; no real market data was supplied. Dataset splits, contract costs, session/holiday filtering, and economic results remain unvalidated.
- MT5 MCP handshake/capability schemas, detected account identity, FxPro symbol contract specs, Windows Credential Manager, app runtime and friend installation.
- Cloud device pairing/revocation, connector cloud polling and command claiming, leases/fencing, connector-to-broker execution, uncertain submission reconciliation and protective management.
- Remote Cloudflare authentication, deployment, Worker CPU budget and actual D1 usage under three users.

## Externally needed later

- Your Cloudflare account, remote D1 database ID, chosen production origin/domain and passkey-auth configuration.
- Your chosen AI provider, model and API key after the adapter is wired, tested and bounded by real provider usage controls.
- Friend's Windows PC, MT5/FxPro demo terminal, local MCP address/key and permission to run read-only discovery followed by deliberate demo-only validation.
- Broker-confirmed exact symbol mappings, contract/tick values, sessions, commission and historical data for research.

## Next implementation work

1. Complete invite/passkey and recovery/revocation flows and verify them in a browser.
2. Implement device pairing, revocable scoped credentials, cloud polling/claim leases, and end-to-end simulated connector flow.
3. Finish broker adapter interfaces and recovery/reconciliation tests while keeping live order calls disabled until demo checks pass.
4. Add authenticated real-provider routing with atomic usage reservations and provider cost/limit handling; keep simulation mock-only.
5. Add backtest dataset split/report metadata and validate on user-supplied broker data.
6. Complete responsive/keyboard and connector runtime QA; update deployment handover after external Cloudflare setup.
