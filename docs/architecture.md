# TradeRelayCity architecture

## Runtime boundaries

- React/Vite is static UI served through Cloudflare Workers Static Assets.
- A TypeScript Cloudflare Worker owns authentication, D1 persistence, invitations, device pairing, AI-provider calls, and durable command APIs.
- Each user runs one Windows connector alongside their own MT5 terminal. The connector talks to the terminal's loopback MCP endpoint and makes outbound HTTPS requests to the Worker.
- The browser never receives MT5 MCP credentials, connector credentials, AI keys, or unrestricted broker tools.
- D1 is the durable cloud command ledger; MT5 remains authoritative for actual broker orders, deals, positions, and balances.
- The local connector keeps a SQLite command journal and bounded offline spool. It persists intent before submission and reconciles ambiguous outcomes before any retry.

## Development and safety modes

- Local development seeds synthetic users/accounts and runs a deterministic mock provider and simulation adapter.
- Simulation routes are guarded by explicit local configuration and loopback host validation. They are absent/disabled in deployed mode.
- Broker-demo mode requires a real detected account binding and validated MCP tool capabilities.
- Live entry execution is disabled by default in the backend and connector; neither key insertion nor a successful build can enable it.

## Decisions inherited from the repository

- Keep the existing React/Vite app rather than replacing its framework.
- Use the user's later explicit brand preferences (TradeRelayCity product name, vibrant royal blue/red identity, Bebas Neue and Roboto) where the attached brief repeats older Botify/Barlow styling suggestions.
- Use same-origin `/api/*` routes so browser credentials can remain HttpOnly cookies and CSRF/origin checks are practical.

## Limits

Cloudflare Workers are request-driven and do not host the local MT5 terminal. The connector runs only while the user's Windows session, MT5, connector and internet are available. The system cannot guarantee execution during PC sleep, broker outages, Worker/D1 outages, or uncertain submission recovery.

## Implemented read-only boundary (2026-11-18)

The owner can create a short-lived pairing code through an authenticated Worker route. The Windows connector exchanges it for a revocable device token, stores that token in Windows Credential Manager, and uses outbound HTTPS to upload a bounded MT5 account snapshot. D1 stores a token digest and the latest broker snapshot. The first accepted snapshot fixes the device's broker/server/login identity. Owner-scoped reads display the observation time and stale state. Simulation fixtures remain separate from broker snapshots.

The local MT5 connector uses the official MCP Python SDK. It calls the terminal workspace pre-flight, discovers tool schemas, then reads account info and open positions. It refuses upload when the terminal reports a disconnected broker session or incomplete identity. The earlier command-ledger, execution, AI, backtest, and reconciliation paragraphs above describe intended architecture where those capabilities are not yet marked implemented in `docs/progress.md`.
