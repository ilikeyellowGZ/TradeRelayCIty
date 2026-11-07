# TradeRelayCity Implementation Plan

> **For agentic workers:** Implement this plan inline in milestone order. The project owner explicitly requested execution through the milestones. Track completion in `docs/progress.md`.

**Goal:** Turn the existing React preview into a working local simulation and then implement the Cloudflare-backed private trading application and Windows connector described by `BUILD_BRIEF.md`.

**Architecture:** Preserve the existing React/Vite application and evolve it into the TradeRelayCity dashboard. Add a same-origin TypeScript Cloudflare Worker with D1 and Better Auth; add a separate Python Windows connector package using the official MCP client and SQLite. Keep simulation fixtures and endpoints local-only, share validated contracts between boundaries, and default all environments to simulation with live execution disabled.

**Tech Stack:** React, TypeScript, Vite, Cloudflare Workers Vite plugin, Hono, D1, Better Auth passkeys, Python, MCP Python SDK, SQLite, tkinter, PyInstaller, Vitest, pytest, Playwright.

**Spec:** `BUILD_BRIEF.md` (full source: `TradeRelayCity_Codex_Build_Prompt.md`).

## Global Constraints

- No actual broker order may be sent during implementation.
- Simulation mode and records must always be labeled SIMULATED and cannot silently fall back into production.
- MT5 MCP and device credentials stay on each user's PC; AI and auth secrets stay in Cloudflare Worker secrets.
- Enforce tenant ownership on every server-side query and mutation.
- Do not invent model names, MCP tools, broker capabilities, balances, or verified outcomes.
- Keep live entries off by default and require explicit owner action plus demo validation.
- Do not claim Windows installer or broker/AI integrations are verified unless they ran with actual dependencies and credentials.
- Keep the prior direct visual preference: vibrant blue/red sports palette and Bebas Neue/Roboto, while changing the product identity to TradeRelayCity.

## Repository map

- `src/`, `index.html`, `vite.config.ts`: existing frontend; evolve rather than discard.
- `apps/worker/`: Hono routes, Better Auth configuration, D1 migrations, shared validation.
- `connector/`: Python connector, local SQLite journal, simulation and MCP adapters, tkinter UI.
- `shared/`: API contracts and shared fixtures where cross-language duplication can be avoided.
- `docs/`: architecture, security, strategy, deployment, connector setup, budgets, validation and progress.
- Root `package.json`: pinned workspaces/scripts; `pyproject.toml`: pinned Python dependencies.

## Milestones and tasks

### 1. Repository, compatibility and architecture
- Preserve current UI files and add this brief, architecture decisions and progress ledger.
- Verify current official SDK APIs and available Node/Python versions.
- Establish locked web/Worker and connector environments.
- Record unavailable Cloudflare, FxPro, AI, Windows-build, and deployment checks.

### 2. Branded app shell and local simulation
- Write failing tests for simulation seed isolation, command state transitions, read-only operations, and API preview states.
- Add D1 migrations and deterministic fixtures for three synthetic users/accounts and the required edge-case samples.
- Implement local Worker simulation routes guarded by explicit local-only configuration and host checks.
- Implement mock AI and simulated broker adapters sharing production contracts; no external calls.
- Connect the React dashboard to the local API; add loading, empty, stale, offline, denied and error states and all listed destinations.
- Verify all three users, account switch isolation and simulated command scenarios.

### 3. Invite-only access and tenant isolation
- Generate Better Auth D1 schema with the pinned official tooling; implement passkey-only login, invitations, owner bootstrap, session security and recovery documentation.
- Add server-owned roles and per-request ownership checks; add tests for cross-user reads/writes/exports and invitation replay/expiry.
- Keep seeded personas available only in explicit local simulation mode.

### 4. Device pairing and Windows connector foundation
- Define versioned JSON contracts and contract tests.
- Implement connector wizard/status UI, protected credential-store abstraction, SQLite journal/spool, single-instance enforcement, account binding and pause/disconnect controls.
- Implement mock connector through the same command/report contract; build and test a Windows package only when this host has the supported toolchain.
- Implement read-only MCP discovery and diagnostics from current official SDK docs; allowlist tools only and never infer unsupported broker capabilities.

### 5. Risk and durable command recovery
- Write failing tests for leases/fencing, duplicate delivery, ambiguous timeouts, account mismatch, command expiry, position sizing and daily limits.
- Add D1 state transitions and scoped command authorization; local write-ahead intent/reconciliation; freeze entry mode whenever required evidence is missing.
- Keep real entry execution blocked until MCP capabilities and broker-demo tests verify all risk prerequisites.

### 6. AI, quotas, journal and review workflow
- Add deterministic mock and provider adapters for OpenAI, Anthropic and xAI, selected explicitly by configuration.
- Validate bounded model responses; reserve/reconcile quota; add cost/token records and trade journal with strategy/prompt versions.
- Require deterministic candidate eligibility, AI approval and local risk approval. Never silently degrade to deterministic-only or live execution.

### 7. Strategy, backtests and operations
- Write `docs/strategy.md` before strategy implementation with closed-bar/no-lookahead rules.
- Add event-driven Python backtest with versioned data, costs and conservative same-candle stop/target assumptions.
- Implement bounded spool recovery, outage states, D1 migrations and retention controls.
- Document build, deployment, owner bootstrap, friend setup, keys and cost limits.

### 8. Final validation and handover
- Run type checks/build, focused TypeScript and Python suites, isolation/security tests, and browser journeys when browser automation is available.
- Report implemented, tested, unverified and externally blocked items separately.
- Leave live trading disabled and list exact owner actions required next.

## Current checkpoint

The repository is a Vite React dashboard preview with no API or connector. Current environment has Node 24.14.0 and Python 3.14.5. No Cloudflare account, D1 database, AI key, FxPro terminal, or MCP credential has been supplied. Verify Python dependency support before pinning the connector runtime; the Windows deliverable must be built/tested on a compatible Windows Python version.
