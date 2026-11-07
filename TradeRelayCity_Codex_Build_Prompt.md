# TradeRelayCity — complete Codex build prompt

Prepared 7 November 2026. This is the current implementation brief for TradeRelayCity. It replaces the earlier Botify architecture wherever that architecture requires a hosted Windows VPS, a separate Linux API server, or mandatory Supabase hosting.

Copy this file into your repository as BUILD_BRIEF.md, or attach it to Codex and ask it to implement the brief. This document specifies work to build; it does not mean the application, installer, broker connection, or strategy has already been verified.

## Prompt starts here

Act as a senior engineer responsible for implementing and handing over TradeRelayCity, a private AI-assisted automated trading application. Build working software, tests, migrations, deployment configuration and a Windows connector. Do not stop after a plan, a dashboard mockup, or a collection of disconnected examples.

I will develop on my Windows PC using VS Code/Codex. I will give my friend an installer for the connector and a link to the website. My friend will run MT5 and the connector on his own Windows PC, logged into his own FxPro account. The dashboard, application API and database will be hosted on Cloudflare. My AI-provider key pays for AI requests and stays in the Cloudflare backend. Each person's MT5 MCP key stays on that person's PC.

Do all work that can be completed without real keys. Provide a working, clearly labeled simulation so I can inspect the application before supplying credentials. Missing keys must not prevent implementing the independent components. Broker integration and paid AI calls remain unverified until they are actually tested with credentials.

### 1. Product scope and decisions

- Product name: TradeRelayCity.
- Broker for the initial integration: FxPro, using a Windows MetaTrader 5 terminal with its MCP feature.
- Support at least three independent application users, each able to connect an independently owned MT5 account.
- Use one authentication system with separate users and account ownership, not three duplicated login implementations.
- Initial roles: owner/admin and trader. An admin can manage invitations, revoke devices and inspect operational health; administration must not reveal MT5 keys or AI secrets.
- Start with one terminal/account per connector installation. Support three connectors on three PCs simultaneously. Do not attempt to multiplex three active accounts by switching one terminal between them.
- Trading continues when the browser is closed, while the user's PC, MT5, connector and required backend services are available.
- My development PC does not need to remain on after deployment.
- Exclude subscriptions, payments, copy-trading between friends, withdrawals, custody, marketplace and KYC collection from version one.
- Do not promise profitability, a win rate, uninterrupted availability, or unlimited free usage.
- No minimum daily trade count. Zero trades is a valid outcome.

First inspect the repository and applicable AGENTS.md files. Reuse working components where suitable, preserve unrelated work and explain material conflicts. Do not replace the entire project merely because a different framework would be convenient.

### 2. Concrete technology choices

Use this starting stack unless the existing repository provides an equally suitable implementation:

| Layer | Choice |
|---|---|
| Website | React, TypeScript, Vite |
| Styling | Tailwind CSS, accessible components, original TradeRelayCity tokens |
| Web API | TypeScript Cloudflare Worker, using Hono where helpful |
| Web hosting | Cloudflare Workers Static Assets, with the API on the same origin |
| Main database | Cloudflare D1, with versioned SQL migrations |
| Authentication | Better Auth with its supported D1 integration |
| Windows connector | Python, official MCP Python SDK, validated data models and structured logs |
| Connector setup UI | A simple packaged Windows wizard, such as tkinter/ttk |
| Local durable state | SQLite for command journal, configuration metadata and bounded offline spool |
| Local secrets | Windows Credential Manager or a verified Windows-protected credential backend |
| Packaging | PyInstaller built on Windows; an installer where practical |
| Verification | TypeScript tests, Python pytest, and Playwright for critical website flows |

Choose maintained compatible versions from current official documentation and lock them. Check the SDK's current APIs rather than copying obsolete MCP client examples.

Do not require Redis, MongoDB, Supabase, Docker, a VPS, a separate Linux server, paid SMTP, or an always-running cloud Python process for this version. Do not install the MT5 desktop application inside Cloudflare Workers.

Prefer D1 prepared statements and reviewed migrations. Better Auth owns its authentication schema. Use its official schema generation for the pinned version and commit the resulting migrations. Do not invent its tables or password hashing.

### 3. Authentication and three-user access

Implement private, invite-only access backed by Better Auth and D1.

Prefer a passkey-first sign-in flow so the initial private app does not depend on SMTP or expensive password hashing in a short Worker CPU budget. Implement invitation-bound passkey enrollment using the library's supported APIs, correct WebAuthn origins/RP ID, expiring challenges, and one-time invitations. Do not expose unrestricted unauthenticated account creation.

Allow an owner to create an invitation, copy the link, and give it to a friend manually. Treat invitations as secrets: store only their token hashes, expire them, scope their permissions, and consume them atomically. Provide a secure initial-owner bootstrap command without hardcoded credentials or a permanent public setup endpoint.

Provide sign-in, sign-out, account management, a second-passkey option, session revocation, and documented recovery using one-time recovery material or owner-issued recovery invitations after identity verification. Do not label an email address verified without verifying it. Do not offer an email reset flow unless an actual email provider is configured.

If implementing email/password as an additional login option, use Better Auth's maintained secure implementation. Benchmark it on the intended Worker plan. Do not weaken password hashing to make the free tier appear compatible. Keep unsupported flows disabled with a clear explanation.

Use secure, HttpOnly, appropriately SameSite cookies; validate origins and CSRF protections for authenticated mutations. Apply rate limits to sign-in, enrollment, pairing, recovery and AI requests. Do not store long-lived website login tokens in browser localStorage.

Every account lookup, command, export, notification and status request must enforce ownership on the server. D1 does not provide PostgreSQL-style row-level security; implement and test the application-level ownership checks explicitly.

### 4. Architecture and where execution happens

Implement these boundaries:

1. The browser talks to the Cloudflare API.
2. The Cloudflare Worker handles authentication, durable command records, AI requests and dashboard data.
3. Each Windows connector makes authenticated outbound HTTPS requests to the Worker.
4. The connector talks to the MT5 MCP server on the same Windows PC.
5. MT5 sends actual orders to the user's broker.

Keep the MT5 endpoint private to the PC. Do not open router ports, publish MT5 through a public tunnel, or put an MT5 key into browser code.

The connector runs the scheduling loop while the PC is on. Cloudflare receives requests and persists state; do not use an infinite Worker loop or an untracked background promise as an always-on bot process.

For automatic entries, the connector submits a fresh, versioned setup snapshot to the Cloudflare AI endpoint. The backend validates it, obtains an AI decision, and creates an account-scoped expiring command only if the decision and policy are valid. The connector claims the command, rechecks the current market/account/risk state locally, and submits the permitted MT5 operation.

The cloud command ledger is durable. The broker is authoritative about actual orders, fills, positions and balances. The local command journal supports crash recovery and deduplication.

### 5. Windows connector: actual deliverable

Build an application named TradeRelayCity Connector. A finished Windows package should run without the friend installing Python, VS Code or development dependencies.

The initial wizard must let the user:

- Enter the TradeRelayCity website URL.
- Pair the device with their signed-in website account.
- Enter the local MT5 MCP address and key.
- Test the connection without placing an order.
- See the detected broker, account login, server, account currency and demo/live status.
- Confirm the exact account binding.
- Review permitted actions and local risk limits.
- Start paused, enable broker-demo operation deliberately, or disconnect.

Use the terminal MCP endpoint, typically http://127.0.0.1:22346/mcp. Read the actual address from the user's terminal settings rather than assuming the default always applies. MT5 exposes the relevant settings under Tools > Options > MCP.

Use Bearer authentication according to the terminal's copied configuration. Initialize a real MCP client, perform capability discovery, validate tool schemas and map only supported operations. Exclude MetaEditor, shell, filesystem, arbitrary web and code-execution tools from the trading connector.

If MCP is missing, explain how to inspect/update the installed terminal and report the exact missing feature. If a required account, risk-calculation or execution capability is unavailable, block the dependent trading mode. Do not invent tools, return simulated success, or claim that a key proves the connection works.

Define a BrokerAdapter interface and implement:
- A clearly labeled simulation adapter for offline development.
- A real MT5 MCP adapter.

A native MT5 Python adapter may be documented as a future compatibility option; do not silently change authentication mechanisms or require broker passwords instead of the agreed MCP setup.

The connector must use a single-instance lock and serialize execution for its bound account. Bind it to the expected broker server, account login and environment; recheck immediately before any trading operation. An account switch must pause new entries and require rebinding.

Use a simple status window showing connected/paused/offline, last sync, account binding, AI availability, pending commands and meaningful errors. An optional tray icon must make background behavior obvious. Provide a local Pause and Disconnect control.

An opt-in launch-at-login task may start the connector after the Windows user signs in. Do not assume MT5 works as an unattended Windows service before login. Explain sleep, reboot and power-loss behavior. Quitting the connector stops its automation and does not imply broker positions have closed.

Build the executable on Windows. Provide a PowerShell build script and packaging configuration. If the current development environment cannot build/test a Windows executable, deliver the source and build workflow and report that limitation accurately.

### 6. Device pairing and secret placement

Implement a short-lived pairing flow with a user-visible confirmation of the device and account. After authenticated approval, issue a unique, revocable device credential scoped to one user and broker account. Store only an appropriate verification hash on the server, rotate credentials, rate-limit pairing attempts, and audit approvals/revocations.

Website sessions and device credentials are different credentials. A device credential must not grant administrator permissions or access to other accounts.

Secrets belong here:

| Value | Location |
|---|---|
| User's MT5 MCP key | Windows protected credential store on that user's PC |
| Connector device credential | Windows protected credential store on that user's PC |
| Owner's AI-provider API key | Cloudflare Worker secret |
| Better Auth/application signing secrets | Cloudflare Worker secrets |
| D1 database identifier and binding name | Deployment configuration, without secrets |
| Account identifiers, strategy settings and execution records | D1, protected by ownership checks |
| Non-secret local metadata and recovery journal | Local SQLite |

Do not embed any real key in the installer, source, screenshots, fixtures, logs, browser bundles or CI artifacts. If the Windows credential backend is unavailable, report the failure instead of silently falling back to plaintext storage.

Do not send broker passwords to Cloudflare. The user logs into their broker inside MT5.

### 7. Durable command delivery and broker reconciliation

Use ordinary outbound HTTPS polling initially, with a configurable default around 15 seconds and bounded jitter. Batch command polling, acknowledgement and lightweight health information where practical. Use backoff during failures. Market strategy evaluation can run more frequently locally without calling Cloudflare on every tick.

Commands need:
- Unique ID and idempotency key.
- Owning user, broker account and assigned device.
- Explicit operation and validated parameters.
- Source signal, AI decision, strategy version and risk-policy version.
- Server issue time, expiry, claim/attempt metadata and execution state.
- Broker correlation identifiers, tickets and results.
- Acknowledgement and reconciliation history.

Use D1-supported atomic batches and conditional state updates for claims, leases and uniqueness. Do not rely on a process-local lock, SELECT FOR UPDATE, or an interactive transaction API that D1 does not support. Define an account execution lease and generation/fencing checks to reduce conflicting connectors; do not claim these create a broker-side exactly-once guarantee.

Suggested states include pending, claimed, submitting, filled, partially_filled, rejected, expired, cancelled and unknown. Define legal transitions and retain unknown until reconciled.

Before submitting, persist intent in the local journal. A timeout after submission does not prove failure. Reconcile broker orders/deals/positions before considering any retry. If reconciliation cannot establish the outcome, pause entries and report uncertainty; never blindly duplicate the order.

On restart, reconcile outstanding local and cloud commands against MT5. Model orders, deals and positions separately, including partial fills, account-specific ticket uniqueness and hedging/netting differences.

Expired signals, revoked devices, stale data, account mismatches, invalid leases and changed policy versions must not produce a new order.

### 8. AI decision engine

Implement a provider adapter interface with a deterministic mock provider and real adapters for OpenAI, Anthropic and xAI/Grok using their current official APIs. Provider and model are configuration values; do not invent a current model name or assume every model supports identical structured-output features.

All real AI requests originate in the Cloudflare backend. The model receives a bounded market snapshot, a candidate setup, relevant historical trade summaries and a versioned decision prompt. Do not give the provider MT5 credentials, the connector credential or direct access to trading tools.

Require a validated response containing:
- Decision ID and input snapshot ID.
- BUY, SELL or HOLD.
- Symbol and applicable strategy version.
- Proposed entry context, stop and target where relevant.
- A short rationale, invalidation conditions and freshness/expiry information.
- Any model confidence labeled as an uncalibrated model score.

Validate numbers, symbols, expiry, direction and allowed schema fields. AI output is untrusted input. Refusals, malformed output, unsupported models, timeouts, rate limits, missing keys and exhausted budgets must have explicit states.

In the default AI-assisted mode, a valid deterministic strategy candidate needs AI approval before a new entry. An AI proposal cannot bypass strategy eligibility, create an unsupported setup, choose unlimited volume, change live rules, disable risk controls or call arbitrary MCP tools.

Final position sizing and execution permission belong to deterministic code on the connector. Never execute free-form model text.

Implement per-user and total-owner daily request/token limits, a maximum response size, bounded retries and a concurrency cap. Reserve usage atomically before calling the provider and reconcile reservations afterward. Show estimated costs and actual token usage separately; price-based estimates require configured, dated rates. A local budget is not a guarantee that the provider cannot bill additional in-flight usage.

When AI is unavailable or its quota is exhausted, default to no new AI-dependent entries. Continue protective management where possible. A deterministic-only mode requires an explicit owner setting and a visible label; never switch into it silently.

Use read-only, untrusted treatment for news and external text. These sources must never supply executable instructions or override the system's authorization and risk rules.

### 9. Learning from completed trades

Implement a genuine evaluation workflow without claiming that calling an LLM automatically retrains its model.

- Store the exact strategy version, market context, AI prompt/model/response, risk checks, execution result and eventual trade outcome.
- Build a journal with relevant closed-trade summaries and bounded historical retrieval.
- Generate review reports and candidate rule/prompt changes from completed outcomes.
- Include sample counts, costs, drawdown and uncertainty; do not rank strategies by win rate alone.
- Version every candidate and compare it with the current baseline using held-out data and broker-demo forward testing.
- Require explicit owner approval before promoting any change to live operation.
- Provide rollback to a previous strategy/prompt version.
- Do not automatically increase risk, activate martingale, or change live parameters after losses.

Label this feature Trade review and improvement. Explain that journal-based adaptation and reviewed strategy changes differ from fine-tuning provider model weights.

### 10. Deterministic baseline strategy

Implement one documented ICT-inspired baseline instead of leaving the strategy as an undefined AI prompt.

Provide configurable symbol mapping, higher-timeframe bias, confirmed swings, liquidity sweeps, displacement, structure shifts, three-candle fair value gaps, retracement entry, expiry, invalidation, stops and targets.

Write docs/strategy.md with the exact sequence, formulas, parameters and competing-signal rules before considering the strategy complete. Include an executable example configuration.

Use closed bars for baseline signals. Define when a swing becomes confirmed and when higher-timeframe candles become available. No look-ahead data. A candle pattern that is only known after two later candles cannot be traded at its earlier timestamp.

Use explicit ATR-based displacement thresholds, left/right swing confirmation counts, gap definitions, retracement levels, maximum setup age and stop buffers. Explain why each candidate is accepted or rejected. Treat confluence as a heuristic, not a probability of winning.

Start with one user-selected FxPro symbol in simulation and broker demo. Handle broker suffixes and contract specifications rather than assuming every account uses exactly the same symbol string.

Respect instrument sessions and holidays. Optional news exclusions need an actual licensed/configured provider; if enabled and unavailable, pause dependent entries. Never fabricate a calendar feed or assume forex trades continuously through weekends.

### 11. Risk engine and live activation

Create an independently testable risk engine, enforced locally immediately before execution and checked again in the backend where appropriate.

Required limits:
- Risk per trade and total account open/pending risk.
- Maximum volume, open positions and daily entries.
- Daily equity loss and account drawdown.
- Symbol/session allowlists, maximum spread and slippage.
- Fresh market/account data, valid broker session and sufficient margin.
- Required broker-side stop protection.

Use the broker's contract specifications and verified account-currency loss/margin calculations. Round volume down to the broker step. Reject zero-distance stops, invalid stop/freeze distances, unsupported filling modes, missing conversion data and minimum volumes that exceed risk.

If MCP does not provide enough data/tools to compute risk reliably, say exactly what is missing and keep entry execution disabled. Do not replace contract-specific calculations with a universal pip-value shortcut.

Include manual and other-bot exposure in account-wide risk. Do not close unrelated positions without a separate explicit scoped instruction.

Define daily reset timezone and treatment of realized/unrealized PnL, commission, swap, deposits and withdrawals. Persist baselines across restarts; restarting must not reset a loss limit.

If required protection is absent after a fill, attempt repair and a controlled close if protection cannot be established, subject to actual broker capabilities. Record and display failures honestly. Stops cannot guarantee the realized loss during gaps.

Separate:
1. Pause new entries while managing existing positions.
2. Stop the strategy and cancel its eligible pending entries.
3. Close explicitly selected bot positions and cancel scoped pending orders.

A remote action remains pending until the connector and broker acknowledge it. An offline PC cannot receive an immediate kill command. Show pending/offline status and a manual MT5 fallback.

Keep live entry execution off by default on both the server and connector. Enabling it requires recent authenticated owner action, detected account binding, an explicit live label, completed local configuration and an available live-validation report. Do not place live trades during implementation or automatically activate live mode when keys are inserted.

### 12. Database schema and API

Provide versioned D1 migrations, indexes and constraints for:
- Better Auth users, sessions, passkeys and required library tables.
- Invitations and recovery records.
- Broker account ownership and confirmed server/login binding.
- Devices, pairing requests and revocation state.
- Strategy versions, risk-policy versions and bot state.
- Signals, market snapshot references and rejection reasons.
- AI decisions, usage reservations, usage records and improvement proposals.
- Execution commands, attempts, account execution leases and acknowledgements.
- Broker orders, deals and positions.
- Equity snapshots, connector health, notifications and audit events.
- Backtest definitions and bounded summary results.

Use UTC timestamps and explicit timezone labels. Store broker ticket identifiers as strings where necessary to avoid JavaScript integer precision loss. Use decimal-safe price, money and volume representations with documented scales. Do not silently add values in different account currencies.

Use real relational columns and foreign keys for ownership and identity. Validated JSON can hold versioned strategy parameters and bounded diagnostics. Use account/time/status indexes and pagination to avoid full-table scans.

Publish a documented API contract for website sessions, invitations, device pairing, heartbeat/batched sync, signal evaluation, commands/results, histories, AI usage and scoped emergency controls. Generate compatible request/response schemas or contract-test TypeScript and Python models against one shared specification.

Use input validation, parameterized queries, bounded payloads, safe error messages, correlation IDs and redacted logs. An admin health endpoint must not disclose secrets.

### 13. Website pages and working behavior

Implement:
- A concise product landing page without invented performance claims.
- Invitation enrollment, sign-in, recovery and account security.
- An onboarding wizard explaining MT5 plus the connector.
- Overview dashboard.
- Accounts and device connection status.
- Bots and strategy configuration.
- Risk settings.
- Open positions and pending orders.
- Trade history with filters, fill details and account-scoped CSV export.
- AI decisions, quota usage and trade review.
- Basic backtests.
- Notifications.
- Owner/admin invitations, device revocation and operational health.

Show account identity, DEMO/LIVE/SIMULATED mode, balance, equity, account currency, realized/unrealized PnL, drawdown, open positions, last update and connector status.

Every relevant screen needs loading, empty, stale, offline, denied, pending and error states. Missing data is an em dash, not a fabricated zero. Distinguish a received request from broker-confirmed success.

A global account switch must update all account-scoped panels together. Do not display one account's data alongside another account's controls.

Poll dashboard data only while visible, with configurable intervals and backoff. Provide clear offline feedback. No browser tab needs to remain open for the connector to work.

### 14. TradeRelayCity visual design

Apply the original MLB-inspired direction already selected for this project, without MLB's logo or a claim of affiliation.

| Token | Value / use |
|---|---|
| Navy | #041E42, navigation, headings, primary controls |
| Burgundy | #77001D, restrained brand accents |
| Cream | #CDC3A8, highlights and identity panels |
| Canvas | #F7F5F0 |
| Surface | #FFFFFF |
| Muted text | #526174 |
| Positive | #146C43 |
| Negative | #B42318 |
| Warning | #8A5200 |

Use Barlow Condensed for short display headings and readable system sans-serif for controls/body/data. Use tabular numerals for financial tables. Self-host fonts with their licenses.

Create an original TradeRelayCity identity. If the chosen project logo files are available, reuse them. Otherwise make a simple temporary original wordmark; do not pretend the previously chosen logo was supplied.

Use a light workspace, navy sidebar, cream accents, restrained burgundy rules, white data panels and clear spacing. Burgundy brand accents must be separate from red loss/error states. Avoid glowing charts, glassmorphism and celebratory trading animations.

Use a 240 px sidebar on wide screens, a drawer on smaller screens, 44 px product touch targets and restrained 8–12 px control/card radii. Keep account/mode/status visible. Support 320 px, tablet and desktop layouts without clipped controls.

Build reusable AppShell, AccountSwitcher, ModeBadge, ConnectionStatus, MetricCard, TradingChart, PositionsTable, RiskSummary, BotControls, EmptyState, ErrorState and ConfirmationDialog components.

Provide keyboard access, visible focus, accessible dialogs, chart data alternatives, sufficient contrast and reduced motion. Include signs, text and icons alongside semantic colors. Respect account currency and instrument precision.

### 15. Local simulation and first-run experience

The complete application must start without real trading or AI keys.

Provide a local development command that starts the web app/API and a local D1 database. Provide a simulated connector and mock AI provider exercising the same contracts as real integrations.

Clearly label all fixtures and generated data SIMULATED. Do not mix simulation results into broker-demo or live records. Production broker mode must not silently fall back to fake data.

Demonstrate three isolated users and three independent simulated accounts. Include sample signals, open/closed positions, a HOLD decision, a quota limit, a rejected order, a disconnect and an expired command.

Generate development secrets locally. Use an explicit local-only seed process; never deploy known passwords, recovery codes or development sessions to production.

The first-run website should show a setup checklist and guide me to the connector download/build instructions. The connector's Test connection action must be read-only.

### 16. Backtests and operational failures

Provide a basic Python event-driven backtest for the deterministic baseline, runnable locally through reviewed jobs or CLI commands. Keep bulk datasets/research computation off the Worker request path.

Version the dataset and strategy. Include spread, commission, slippage and conservative handling when a candle touches both stop and target. Separate training/validation/held-out periods and avoid invented results.

Do not present a deterministic backtest as a historical test of live AI judgments. AI-assisted evaluation uses saved time-appropriate decisions or separately labeled forward tests.

Handle loss of MT5, AI, Cloudflare or D1; PC sleep/reboot; revoked devices; expired sessions; schema changes; clock drift; account switching; duplicate commands; uncertain submissions and partial fills.

When authorization, durable command state, required AI approval or risk data is unavailable, block new entries. Existing broker-side stops are independent of the dashboard; local trailing/protective logic only operates while the required local components and permissions remain available.

Use a bounded local spool and replay idempotently after reconnect. Do not silently resume live entries following an uncertain recovery. Track the visible bot state separately from connection health.

### 17. Free-tier and usage design

Optimize for a small private deployment using Cloudflare's free allowances where feasible. Do not claim it is unlimited or guaranteed free.

Provide docs/costs-and-limits.md with dated official sources, configuration assumptions and an estimated budget for three users.

For example, three connectors polling every 15 seconds generate about 17,280 requests per day before dashboard requests and AI calls. Count D1 rows read/written, index writes, snapshots, authentication and AI usage separately. Do not assume one query means one row billed.

Batch heartbeats, avoid per-tick database writes, index account-scoped queries, paginate histories, retain bounded logs and make snapshots less frequent than local evaluation. Provide retention settings.

Benchmark Worker CPU, particularly authentication and response validation, against the intended plan. Do not describe Workers as a permanent resident process. If a feature exceeds the free plan, document the measured limitation and keep a usable configuration; do not silently purchase or enable paid resources.

AI-provider quotas/billing are separate from Cloudflare hosting. No provider key means simulation or a clearly disabled real-AI integration. Do not assume a ChatGPT, Claude or Grok chat subscription includes API access or unlimited credits.

### 18. Key templates and deployment

Create these example files without real secrets:
- apps/web/.env.example for public configuration only.
- apps/api/.dev.vars.example for local backend configuration/secrets.
- connector/config.example.json for non-secret connector settings.
- wrangler.jsonc, D1 migrations and scripts for local/remote setup.

Use documented configuration such as:
- APP_BASE_URL and a generated BETTER_AUTH_SECRET.
- AI_PROVIDER = mock, openai, anthropic or xai.
- AI_MODEL and the selected provider's server-side secret.
- Per-user and owner AI limits.
- Default environment = simulation.
- Live-entry execution = disabled.
- Local MT5 MCP URL, expected account/server and local credential references.

MT5 keys are entered through the connector wizard; they must not be ordinary fields in a committed JSON configuration. Real AI keys are added with Worker secrets, not Vite public environment variables.

Provide an interactive setup script/checklist that:
1. Checks Node and compatible Python versions.
2. Installs locked dependencies and applies local migrations.
3. Starts simulation without credentials.
4. Guides Cloudflare login, D1 creation/binding and domain/origin configuration.
5. Generates application secrets and safely bootstraps the owner.
6. Explains where to add a selected AI-provider key and model.
7. Builds/deploys the Worker and static assets after the required account setup.
8. Builds the Windows connector on Windows.
9. Walks the friend through pairing and entering his own MT5 key.

If a Cloudflare account, D1 ID or permission is still needed, give exact steps. Supplying two API keys alone does not create the cloud resources or prove a broker connection.

Provide commands using PowerShell for my Windows development and packaging workflow. A deployment credential must never appear in source control. Keep production secrets out of build output.

### 19. Meaningful verification

Implement focused tests for the boundaries that can cause financial or account-isolation errors:

- Three users cannot read, alter, export or receive each other's data or commands.
- Invitation, enrollment, recovery, pairing, revocation and role checks work.
- Expired/replayed requests, duplicate command delivery, two connectors and stale leases are rejected appropriately.
- A timeout after submission is reconciled without blind resubmission.
- An account/server switch blocks execution.
- Position sizing respects broker steps, minimums, account currency and concurrent exposure.
- Daily loss limits survive restart.
- AI malformed output, HOLD, quota exhaustion and provider outage create no unintended entries.
- Pause, Stop and scoped Close have distinct acknowledged behavior.
- Simulation cannot submit real orders or be mislabeled as broker data.
- Browser journeys cover onboarding, account switching and offline/pending states.
- Installer instructions are exercised on Windows when available.

Run linting, type checks, relevant tests and production builds. Do not add repetitive tests that only restate UI implementation.

Without broker credentials, use a realistic adapter test double and saved non-secret protocol fixtures. Report real MT5 and AI-provider verification as pending. With authorized credentials later, run read-only checks first and require deliberate broker-demo execution testing before live activation.

Do not claim a Windows installer was tested if only the Python source ran on Linux. Do not claim the app is live-ready because the dashboard builds.

### 20. Implementation order and final handover

Work through these milestones:
1. Inspect the repository, record architecture choices and select compatible versions.
2. Build the branded app shell, D1 schema and invite-only authentication.
3. Finish three-user isolation and an end-to-end simulated connector/AI/command flow.
4. Implement the real read-only MCP adapter, pairing and capability diagnostics.
5. Add risk controls, durable execution, recovery and broker-demo operation.
6. Add AI-assisted decisions, quotas, journal and improvement proposals.
7. Complete basic backtests, Windows packaging, deployment scripts and usage budgets.
8. Run appropriate verification and document external steps still pending.

Make reasonable reversible engineering decisions and continue implementing. Ask only for a decision that materially blocks the work; do not repeatedly request API keys that I have said I will supply later.

Maintain docs/progress.md with completed work, exact test results and next steps so work can continue after a context reset. Separate implemented, tested, unverified and externally blocked items.

Deliver:
- The working source repository and dependency locks.
- Database migrations and API contracts.
- Tests and a labeled simulation.
- Windows connector source, build script and installer/artifact where actually built.
- README.md with copy/paste commands.
- docs/architecture.md.
- docs/strategy.md.
- docs/security-and-credentials.md.
- docs/cloudflare-deployment.md.
- docs/windows-connector.md.
- docs/friend-setup.md, written for someone who only wants to install and use it.
- docs/keys-and-first-run.md, listing exactly which value goes where.
- docs/costs-and-limits.md.
- docs/validation-report.md and a final list of remaining external checks.

Start implementing now. Do not end with only a proposed plan.

## Prompt ends here

## Official implementation references

Verify current documentation during implementation; these links identify the intended mechanisms, not a guarantee that a specific installed terminal supports every tool.

- MT5 MCP configuration: https://www.metatrader5.com/en/terminal/help/mcp_and_ai/configuration
- MT5 MCP capabilities: https://www.metatrader5.com/en/terminal/help/mcp_and_ai/capabilities
- Official MCP Python SDK: https://github.com/modelcontextprotocol/python-sdk
- MCP Python transport documentation: https://github.com/modelcontextprotocol/python-sdk/blob/main/docs/client/transports.md
- Cloudflare Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/
- Cloudflare Worker secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare D1 database API: https://developers.cloudflare.com/d1/worker-api/d1-database/
- Cloudflare D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- Better Auth database integration: https://better-auth.com/docs/concepts/database
- Better Auth passkeys: https://better-auth.com/docs/plugins/passkey
- OpenAI structured outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- Anthropic API: https://platform.claude.com/docs/en/api/messages
- xAI API: https://docs.x.ai/overview
- PyInstaller operating model: https://pyinstaller.org/en/stable/operating-mode.html

## Where the keys go after implementation

| Item | Where you add it |
|---|---|
| Your selected AI-provider API key | Cloudflare Worker secrets |
| Your selected AI model | Backend configuration |
| Your friend's MT5 MCP key | Connector setup on his own Windows PC |
| Connector pairing credential | Generated by pairing and saved automatically on his PC |
| Application authentication secret | Generated during setup and saved as a Worker secret |
| Cloudflare account/database identifiers | Deployment setup, not the frontend |

Build and inspect simulation first. Add real keys, complete read-only connectivity checks, and test on a broker demo account before deliberately enabling live entries.

