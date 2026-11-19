# TradeRelayCity public user and automatic trading design

Date: 2026-11-19
Status: approved design; implementation and broker validation pending

## Goal

A person can visit one TradeRelayCity website URL, create an account and save recovery codes, download `TradeRelayCity-Connector-Windows.exe`, sign in to MetaTrader 5 (MT5) with their own broker account, pair the connector, and use the website for their own account data, AI assistance, strategy controls, trading status, and history. They do not need a Cloudflare account, project source, Node.js, or Python. Each user can opt in to automatic live trading only after the application proves that their account and connector are ready.

The shared Cloudflare Worker, D1 database, and AI provider keys are operated by TradeRelayCity. The connector and MT5 run on each user's Windows PC. The website controls and displays trading; the local connector performs broker operations through MT5's loopback MCP server. No website request can directly reach a user's MT5 terminal.

## Scope and present state

This design uses the existing React/Vite website, Hono Worker, Better Auth, D1 migrations, Python connector, strategy specification, risk precheck, and demo execution state machine. The deployed staging Worker now supports public username/password signup, recovery codes, per-user pairing, and read-only MT5 snapshots. A separately armed local demo bot exists, but a real broker demo fill has not been verified. Live-account order entry remains disabled. Existing simulation history is synthetic and is not broker trade history.

The first supported automatic strategy is `docs/strategy.md` version 0.1.0: closed M15 signals with H1 context and the documented sweep, displacement, fair-value-gap, stop, target, and expiry rules. Its current CSV backtest does not establish profitability or broker execution readiness. Exact broker symbol and contract data must be checked per account; a symbol is never enabled merely because its display name resembles `EURUSD` or `BTCUSD`.

## User accounts and data separation

- Public sign-up creates a normal user account with a unique username and no email requirement. Eight one-time recovery codes are displayed once and stored as keyed hashes. If a user loses both their password and codes, automated recovery is unavailable. The existing owner account becomes a service administrator, not the owner of other users' broker accounts.
- Better Auth handles username/password sign-in, sign-out, and sessions; a bounded same-origin API creates accounts and handles recovery codes. A used code changes the password and revokes prior sessions. A signed-in user can replace codes after confirming their current password. Sign-up, recovery attempts, password attempts, and pairing exchange are rate limited. No email provider is required.
- Every broker account, device, pairing code, snapshot, strategy setting, command, AI usage row, and broker trade record has an immutable user owner ID. Browser routes derive that ID from the signed-in session; connector routes derive it from the device token. SQL reads and writes include the owner ID and return the same absent response for foreign IDs. The simulation persona header remains loopback-only and cannot authorize hosted data.
- A pairing code is short-lived, single-use, and stored as a digest. The connector stores its device credential and MT5 key in Windows Credential Manager. First valid snapshot binds device, broker, server, login, account environment, and currency. Switching broker accounts requires revocation or explicit re-pairing; it never silently rebinds.
- Administrator functions for service operations use separate role checks and never grant a browser session blanket access to a user's broker data or trading controls.

## First-run experience

1. The landing page offers **Create account**, **Sign in**, and **Download for Windows**. After sign-up, the user saves eight one-time recovery codes and signs in. No email verification is used.
2. A website setup guide checks that the user installed MT5, signed in to their broker account, and enabled MT5's local terminal MCP endpoint. It links to the matching connector download and explains where to copy the endpoint and key. The release connector starts with the exact website origin selected at build time, currently `https://traderelaycity.service-heyywebb.workers.dev`.
3. The connector saves the MT5 key in Windows Credential Manager, runs a read-only connection check, and shows the detected broker, server, login, account type, and currency. It reports errors without revealing the key.
4. The user creates a pairing code on the website, pastes it into the connector, and syncs a snapshot. The website confirms the device and exact broker identity, shows last observation time, and distinguishes demo from live accounts.
5. A readiness page lists the specific unmet conditions for automatic trading. New accounts start paused. The user sets risk limits and validates the strategy and order flow on their own demo account. To use a live account, they re-pair the connector to that account, pass its separate readiness checks, and explicitly enable automatic trading on both website and connector. The website offers a pause control that immediately prevents new server commands; the connector checks that state again before submission.

The Windows release is one downloadable application, with no source setup for recipients. Packaging verifies the executable and website download match. A signed release is required for the intended smooth Windows installation; the current executable is unsigned. The connector must display its version and detect an unsupported website/connector protocol version before allowing new entries.

## Automatic trading and data flow

The connector evaluates the strategy while it and MT5 are running, even if the browser is closed. It reads closed M15/H1 bars, the current broker account, exact symbol metadata, fresh quotes, open positions, pending orders, and recent broker deals through allowlisted MT5 MCP tools. It sends only bounded, authenticated observations and candidate details to the Worker. The Worker stores user-scoped evidence and obtains a structured AI opinion from its configured provider. An AI response is advisory: malformed, unavailable, `HOLD`, or unmatched output blocks a new entry. AI receives bounded market/candidate facts, not MT5 keys, broker login, account balance, or device credentials, and has no direct MT5 tool access. Per-user and service-wide quotas bound usage and cost.

The Worker applies the documented strategy and risk policy to a deterministic candidate, reserves a command with an idempotency key, exact account binding, strategy version, expiry, and lease, and makes it claimable only by that account's active connector. The connector re-reads broker identity, quote, contract, available margin, existing exposure, and session state immediately before submission. It applies the risk gate again, including maximum per-trade risk, total risk, daily loss, drawdown, positions, entries, spread, slippage, and a broker-side stop. Missing or stale facts block entry. User-selected limits may be stricter than system ceilings, never weaker.

The connector persists intent in its local SQLite journal before one MT5 order call. It records broker ticket/deal evidence and acknowledges the resulting state to D1. Timeouts or uncertain results become `unknown` and block re-submission until broker orders and deals provide conclusive reconciliation. Website history uses broker-confirmed fills, charges, and timestamps; it labels incomplete or uncertain outcomes plainly. MT5 remains the authority for order and position state.

Automatic trading is disabled until a connected demo account has passed exact tool/schema checks, order-check behavior, a minimal-volume order, partial-fill/rejection/timeout handling, and broker-history reconciliation. Live enablement is a separate per-user, per-account opt-in after those validation gates. Revocation, pause, stale market data, account mismatch, connector version mismatch, unresolved command, exceeded limit, or service outage blocks new entries. An offline connector cannot manage or close an existing broker position; the UI must state that clearly.

## Components and boundaries

| Component | Responsibility | Depends on |
|---|---|---|
| Public and private web UI | Sign-up, setup, account view, limits, readiness, pause, AI questions, trade history | Same-origin Worker API |
| Auth and user service | Sessions, recovery codes, reset, role checks, abuse limits | Better Auth, D1 |
| Broker API | User-scoped device pairing, snapshots, account reads, settings, command ledger, history | Auth, D1, device token validation |
| AI service | Bounded question classification and strategy opinion, quota and cost records | Server-side provider credentials; no broker tools |
| Windows connector | MT5 discovery, strategy evaluation, local risk gate, journal, order submission and reconciliation | User's MT5 terminal, Worker HTTPS API, Windows Credential Manager |
| MT5 terminal | Broker account, quotes, contracts, orders, deals, positions | User's broker connection and local MCP endpoint |

## Failure handling and verification

Account isolation is enforced in server queries, not by hiding UI elements. Cross-user IDs, revoked devices, expired/replayed codes, forged sessions, and mismatched account identities must be rejected. The Worker and connector have independent new-entry gates. The connector never forwards arbitrary MCP tool names from AI or the website. Network retries are bounded and cannot replay an uncertain order. Outages and old snapshots show their last known time and pause new entries. The site retains a durable audit trail of strategy version, candidate facts, AI opinion, risk decision, command transitions, and broker evidence without storing MT5 keys.

Automated verification covers public auth flows and abuse limits; cross-user access for every route and table; pairing, revocation, and account-switch behavior; broker field normalization; strategy determinism; risk boundaries; command lease/idempotency; crash recovery; success, rejection, partial fill, timeout, and reconciliation. Release verification includes a clean-Windows first-run test, connector-to-website version check, real demo broker round trip, and deployed HTTPS smoke checks. Live mode is exposed only after the demo evidence is reviewed and the exact live account and symbols pass readiness checks. No project test or build may place an unrequested live broker order.

## Delivery sequence

1. Public account lifecycle with recovery codes, per-user data ownership, and cross-user verification.
2. Recipient setup guide and connector release defaults/versioning; multi-user pairing and read-only broker data on the hosted URL.
3. Broker history, exact symbol/contract reads, strategy inputs, AI decision routing, and user risk settings.
4. Demo command ledger, connector order adapter, journal recovery, reconciliation, and end-to-end demo validation.
5. Per-account live opt-in, independent live safeguards, signed Windows release, and production verification.

Each sequence step must leave the prior deployed trading mode explicit. Shipping an earlier step does not imply that later trading capabilities are active.

## External dependencies

TradeRelayCity operates the Cloudflare Worker/D1 deployment and AI provider account and keys. Users supply their own Windows PC, MT5 installation, broker account, and broker permissions. The website and connector require internet access; the connector and MT5 must remain running for automatic trading. Current [MetaTrader MCP configuration](https://www.metatrader5.com/en/terminal/help/mcp_and_ai/configuration) and [capabilities](https://www.metatrader5.com/en/terminal/help/mcp_and_ai/capabilities) document terminal order tools but say capabilities can change, so the connector must discover and validate the actual tools and schemas. Better Auth's [username plugin](https://better-auth.com/docs/plugins/username) still requires an internal email value; the public account API uses a unique synthetic address that is never shown as a contact address.
