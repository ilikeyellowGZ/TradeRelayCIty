# TradeRelayCity

TradeRelayCity is a forex and cryptocurrency trading control-room project with public website accounts and a local-first simulation. The web app is React + TypeScript + Vite, served with a TypeScript Hono Worker on Cloudflare Workers Static Assets and D1. A Windows connector source package is in `connector/`.

The current local simulation has three isolated personas and D1-backed accounts, positions, events, decisions, and command states. Every fixture is labeled `SIMULATED`; the DB schema enforces `is_live=0`. Each signed-in user can pair a connector to upload MT5 account snapshots to their own workspace. A separately armed, local EURUSD demo bot is available in source; broker demo fills remain unverified. Live-account order submission is disabled.

## Run locally (PowerShell)

```powershell
./scripts/setup.ps1
./scripts/bootstrap-owner-password.ps1
npm run dev
```

Open `http://127.0.0.1:5173`. Sign in with the username and password chosen during local owner setup. The local D1 store is in `.wrangler/state`. Switch fixture personas from the account menu. No AI, broker, or Cloudflare API keys are needed for the local fixture UI.

`npm test` runs focused TypeScript simulation tests. `npm run build` creates the Worker and asset bundles. The public landing page downloads a single Windows connector executable; `connector\build-windows.ps1` builds it from the locked Python requirements and publishes the website asset. See [connector notes](docs/windows-connector.md) for the release steps.

## Research backtest

The deterministic baseline has a local, event-driven, CSV-based research runner. It requires user-supplied M15 and H1 OHLC files with offset-aware ISO timestamps and `timestamp,open,high,low,close` columns. Costs are price-unit inputs; use the broker's actual historical spread, commission and slippage assumptions when available.

```powershell
Set-Location connector
.\.venv\Scripts\python.exe -m traderelaycity_connector.backtest --m15 .\data\EURUSD-M15.csv --h1 .\data\EURUSD-H1.csv --symbol EURUSD --spread 0.0002 --slippage 0.0001 --commission 0 --output .\backtest-report.json
```

It reports net R, mean R and max drawdown in R, and assumes the stop is hit first when one candle reaches both stop and target. It does not contain bundled historical data or claim strategy performance. Use chronological train, validation and held-out datasets before interpreting results.

The local simulated connector can claim and acknowledge one pending HOLD fixture. It never talks to MT5 or sends an order:

```powershell
Set-Location connector
.\.venv\Scripts\python.exe -m traderelaycity_connector.simulation_client --persona sim-owner --account sim-account-owner
```

## Current status and safe limits

- Simulation API and seed data are local only. It is not authenticated production account access.
- The website supports public username/password signup with no email address. Eight one-time recovery codes are shown at signup, stored only as keyed hashes, and can reset the password while revoking prior sessions. A signed-in user can rotate codes with their current password. The owner bootstrap remains available for local development. Remote login and recovery still require validation before inviting users.
- The Groq structured-output adapter supports `openai/gpt-oss-20b` and `qwen/qwen3.8-27b`. It is not wired to a production endpoint or verified with a real key. The decision path remains a local, quota-limited HOLD simulation. The assistants separately support bounded provider-based question interpretation.
- The Assistant has separate simulation and MT5 snapshot sources. The simulation source stores persona/account-scoped conversations and answers from fixture records. The MT5 source answers limited account questions from the latest user-bound snapshot, including its observation time and stale status. An optional server-side OpenAI, Anthropic, xAI, Groq, or Gemini classifier can interpret a question while the Worker renders account facts. Neither Assistant source submits trades. The separate demo bot requests an AI candidate opinion through its own bound connector route. Apply migrations `0005_account_chat.sql`, `0006_trade_history.sql`, and `0009_connector_pairing.sql` through `0015_account_recovery.sql` before using these sources.
- Per-user device pairing, connection status, and MT5 snapshot upload are implemented in source. Snapshots include balance, equity, used/free margin, floating profit, and open positions; older records show unavailable margin/P&L until their next sync. The connector can retry snapshots every 15 seconds while automatic sync is enabled. The local demo bot has a guarded execution and reconciliation path, documented in [MT5 demo bot test](docs/demo-bot.md). A connected broker account and deployed authenticated Worker are still required to verify the full path. Live entries are disabled.
- The read-only connection check blocks trade, shell, filesystem, and web tools; it never claims that a successful handshake proves account binding. Only the separately armed demo bot can call the exact market order tool after its risk gates.
- A live account can only be read; no order tool is called for it.

## Deployment

Hosting target is Cloudflare Workers + D1, not Oracle VM. Remote deployment needs a Cloudflare account, created D1 database ID, chosen application origin, `BETTER_AUTH_SECRET`, generated auth schema, and owner bootstrap. Follow [Cloudflare deployment](docs/cloudflare-deployment.md); the placeholder D1 ID intentionally prevents accidental deployment.

## Project documents

- [Architecture](docs/architecture.md)
- [Implementation progress](docs/progress.md)
- [MT5 integration checklist](docs/integration-checklist.md)
- [API contract](docs/api-contract.md)
- [Trade History handover](docs/features/trade-history-handover.md)
- [Strategy specification](docs/strategy.md)
- [Security and credentials](docs/security-and-credentials.md)
- [Cloudflare deployment](docs/cloudflare-deployment.md)
- [Windows connector](docs/windows-connector.md)
- [Optional broker AI classifier](docs/broker-ai-classifier.md)
- [Native MT5 MCP setup](docs/mt5-mcp-setup.md)
- [Friend setup](docs/friend-setup.md)
- [Keys and first run](docs/keys-and-first-run.md)
- [Costs and limits](docs/costs-and-limits.md)
- [Validation report](docs/validation-report.md)
