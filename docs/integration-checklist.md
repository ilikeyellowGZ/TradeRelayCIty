# MT5 integration audit and next work

Updated 2026-11-18. The repository is an existing React/Vite frontend, Hono Cloudflare Worker, D1 database, Better Auth owner login, and Python Windows connector. Supabase files are historical; the active app does not use Supabase Auth or PostgreSQL. The overview, trade history, and original assistant still use explicitly labeled local simulation fixtures.

| Capability | Status | Evidence or limit |
|---|---|---|
| Owner login and protected `/app` | Implemented, locally tested | D1 session cookie; remote staging login and expiry still unverified |
| Local simulation, deterministic HOLD provider, CSV backtest | Implemented, locally tested | No broker order path or performance claim |
| MT5 native MCP discovery | Implemented, terminal verified | Official Python SDK discovered 107 tools; terminal broker connection was disconnected |
| Device pairing, revocation, owner-scoped snapshot/status API | Implemented, locally tested | Migrations 0009–0011 applied locally; remote staging and multi-user provisioning unverified |
| Windows connector snapshot collection and auto retry | Implemented, partially verified | SDK reads account and open-position tools; connector reports offline/error/pause states; margin/profit keys confirmed on disconnected terminal; connected FxPro values and nonempty position mapping unverified |
| Broker Accounts/Positions pages | Implemented, browser checked with synthetic UI data | Balance, equity, MT5 floating P&L, used/free margin, and stale/empty states; no actual broker snapshot yet |
| MT5 snapshot question assistant | Implemented, locally tested | Deterministic read-only balance, margin, positions and P&L answers with source/time; no model provider called |
| Groq/Gemini decision adapters | Implemented but not routed to production | Structured opinion validation exists; real key/provider calls not verified |
| OpenAI/Anthropic/xAI question classifier adapters | Implemented, locally mocked | Owner-scoped route, fixed output schema, 30/day cap, server-side keys; no real key or provider response verified |
| Broker closed history, symbol specifications, ticks and candles | Missing | Tool names discovered; response mapping and account-scoped persistence not built |
| Native MT5 Strategy Tester UI and result storage | Missing | Tester tool schemas discovered; no EA, configuration or test run provided |
| Demo command queue and broker reconciliation | Partial | Local journal/risk and isolated state-machine work exist; no Worker-to-connector execution workflow |
| Live order execution | Disabled | Requires explicit owner approval and verified demo execution/reconciliation |

## Priority order

1. Connect MT5 to the intended FxPro account and validate a real read-only snapshot, including nonempty positions and account type. Fix only observed response-shape differences.
2. Verify remote owner login, migration 0009, pairing, revocation, and snapshot upload on staging over HTTPS. Do not use the production D1 placeholder.
3. Add account-scoped broker history, pending orders, symbol specifications, candles, and analytics from discovered MCP schemas. Keep sync timestamps and failures explicit.
4. Configure and verify one supported OpenAI, Anthropic, or xAI model for the optional question classifier; then extend provider-backed explanations only after evaluation against grounded broker records. No provider call has been verified with a real key.
5. Build the native tester job queue and UI after an EA path and Strategy Tester configuration are available. Store reports with strategy version, costs, and train/validation dates; compare results without auto deployment.
6. Complete a durable demo command queue, fresh server and connector risk checks, idempotent journal, timeout-as-unknown handling, and broker reconciliation. Validate on a demo account only.
7. Finish Windows startup support, signed packaging, remote security review, performance checks, and full mobile/keyboard QA. Keep live trading disabled until separately authorized.

## Run current source locally

```powershell
./scripts/setup.ps1
./scripts/bootstrap-owner-password.ps1
npm run db:migrate:local
npm run dev
```

Open `http://127.0.0.1:5173`, sign in as the owner, and use **Accounts** to create a pairing code. On the MT5 PC, run the Windows connector, enter the configured loopback MCP endpoint and key, pair, and sync. Local HTTP is permitted only on loopback; hosted URLs must use HTTPS. See [MT5 setup](mt5-mcp-setup.md) and [connector setup](windows-connector.md). The public Windows executable was rebuilt, but its unsigned runtime has not been interactively verified.
