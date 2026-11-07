# TradeRelayCity

TradeRelayCity is a private trading control-room project with a local-first simulation. The web app is React + TypeScript + Vite, served with a TypeScript Hono Worker on Cloudflare Workers Static Assets and D1. A Windows connector source package is in `connector/`.

The current local simulation has three isolated personas and D1-backed accounts, positions, events, decisions, and command states. Every fixture is labeled `SIMULATED`; the DB schema enforces `is_live=0`. The connector is an early read-only MCP setup wizard and **does not submit orders or connect to a deployed user account**. Live trading is disabled.

## Run locally (PowerShell)

```powershell
npm ci
Copy-Item .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

Open `http://127.0.0.1:5173`. The local D1 store is in `.wrangler/state` and can be reset by removing `.wrangler` and reapplying migrations. Switch fixture personas from the account menu. No AI, broker, or Cloudflare API keys are needed for the local fixture UI.

`npm test` runs focused TypeScript simulation tests. `npm run build` creates the Worker and asset bundles. `connector\build-windows.ps1` builds the Windows app folder from the locked Python requirements; see [connector notes](docs/windows-connector.md).

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
- Better Auth passkey routes, CLI-generated D1 schema, hashed one-time invitations, owner bootstrap and invite-only enrollment UI are in source. The full WebAuthn ceremony has not been exercised with a physical authenticator, so do not deploy before that verification.
- OpenAI, Anthropic and xAI structured-output adapter code is present but not wired to a production endpoint or verified with real keys. The only callable AI path is a local, quota-limited, deterministic HOLD simulation.
- The Assistant page is a local simulation feature. It stores persona/account-scoped conversations with a 90-day expiry and returns deterministic answers from saved account, open-position, command, decision, and synthetic `TradeOutcomeV1` records. It does not call an AI provider; broker-reconciled history, validated learning, live broker capabilities, and chat actions are not connected. Apply migrations `0005_account_chat.sql` and `0006_trade_history.sql` before using it.
- FxPro account binding, device pairing, production connector polling and broker execution/reconciliation are not implemented. The connector remains read-only and live entries are disabled.
- The connector checks discovered MCP tools and optionally calls a read-only account-info tool. It blocks trade, shell, filesystem and web tools; it never claims that a successful handshake proves account binding.
- Do not point the incomplete connector at a live account.

## Deployment

Hosting target is Cloudflare Workers + D1, not Oracle VM. Remote deployment needs a Cloudflare account, created D1 database ID, chosen application origin, `BETTER_AUTH_SECRET`, generated auth schema, and owner bootstrap. Follow [Cloudflare deployment](docs/cloudflare-deployment.md); the placeholder D1 ID intentionally prevents accidental deployment.

## Project documents

- [Architecture](docs/architecture.md)
- [Implementation progress](docs/progress.md)
- [API contract](docs/api-contract.md)
- [Trade History handover](docs/features/trade-history-handover.md)
- [Strategy specification](docs/strategy.md)
- [Security and credentials](docs/security-and-credentials.md)
- [Cloudflare deployment](docs/cloudflare-deployment.md)
- [Windows connector](docs/windows-connector.md)
- [Friend setup](docs/friend-setup.md)
- [Keys and first run](docs/keys-and-first-run.md)
- [Costs and limits](docs/costs-and-limits.md)
- [Validation report](docs/validation-report.md)
