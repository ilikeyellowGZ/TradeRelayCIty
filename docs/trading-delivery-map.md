# TradeRelayCity delivery map for public users and automatic trading

Date: 2026-11-19
Design: `docs/superpowers/specs/2026-11-19-public-users-live-trading-design.md`

The approved experience is one hosted website where any verified user can sign in, download the Windows connector, pair their own MT5 account, and eventually use automatic live trading. The website is the control surface; each user's connector and MT5 terminal execute broker operations locally. Delivery is split into independently testable releases because the current connector is read-only and the actual broker tool schemas and connected-account responses must be verified before an order adapter is specified.

## Release 1: Public accounts and read-only handoff

Executable plan: `docs/superpowers/plans/2026-11-19-public-accounts-and-pairing.md`.

Create verified public sign-up and password recovery, use session-derived per-user ownership for broker routes, keep pair/device tokens per user, embed the production website origin in the Windows release, and write a recipient first-run guide. Exit evidence: two fresh users can sign up, verify, pair distinct connectors, and see only their own snapshots on the same hosted URL; cross-user requests fail; an unsigned or revoked device cannot upload. Automatic entry remains disabled and visibly labeled.

## Release 2: Broker facts, strategy inputs, AI, and history

Write a separate executable plan after a connected demo MT5 terminal exposes the exact input/output schemas for account info, M15/H1 closed bars, quote and spread, symbol contract and session, pending orders, open positions, and recent orders/deals. Capture only tool names, schema shapes, and redacted representative field types; do not log credentials or complete account identifiers.

The plan will add Python normalizers under `connector/traderelaycity_connector/` with fixture tests for missing, malformed, stale, and broker-specific fields; D1 migrations for user-scoped strategy settings, candidate evidence, and broker history; Worker routes under `apps/worker/src/broker/`; and website views under `src/features/broker/` and `src/features/trade-history/`. Reuse `connector/traderelaycity_connector/strategy.py` and `risk.py` for candidate/risk calculations; route a bounded strategy opinion through `apps/worker/src/ai/real-providers.ts` only after provider credentials, quotas, and schema validation are tested. No model receives an MT5 key, device token, broker login, or account balance.

Exit evidence: the connector detects a deterministic candidate from closed bars and exact symbol facts without look-ahead; broker history is reconciled to user-owned account identity and shown separately from synthetic simulation history; failed AI or missing broker facts yields HOLD; two users cannot read each other's strategy settings, AI usage, or history. This release still does not submit an order.

## Release 3: Demo-only automatic execution

Write a separate executable plan from the verified Release 2 schemas and the discovered `trade_send_market_order`, order-check, history, and position tool contracts. The plan will create a user/account-scoped D1 command ledger and lease/fence API, wire the connector's `demo_execution.py` and `journal.py` to an allowlisted MT5 order adapter, and add website controls for demo enablement, limits, pause, and command status. Server and connector both apply the risk gate immediately before submission. The connector persists intent before one broker call and reconciles a timeout or uncertain result before any possible retry. The AI service never invokes MCP tools directly.

Exit evidence: simulated broker tests cover success, rejection, partial fill, timeout, duplicate claim, restart, stale data, account switch, revoked device, and pause. A connected demo terminal completes a minimal-volume order with a broker-side stop, and the website displays the broker-confirmed order/deal outcome. Any unknown outcome pauses new entries for that account. The release is demo-only: `LIVE_ENTRY_EXECUTION_ENABLED` remains false.

## Release 4: Per-account live opt-in and recipient release

Write the live plan only after Release 3 demo evidence is reviewed. It will add independent website and connector live-enable switches, exact live broker/server/login binding, readiness checks for each live symbol and account currency, immutable account risk ceilings, emergency pause, release protocol version checks, and a durable audit trail. The system cannot infer live readiness from a demo result alone: it must verify the current live account's symbol contract, session, quote, margin, stop and fill rules, and broker history read path.

Exit evidence: live mode is disabled on install and after account switch or connector downgrade; user opt-in is recorded for that specific account; forced failures prevent new orders; the connector build is signed and the website serves the matching hash; a clean Windows setup reaches the readiness screen without project source or developer tools. A controlled live validation uses a separately authorized funded account and operator-visible order; no automated project test sends a live order. Only after that validation may the production release expose automatic live entry to users.

## Cross-release acceptance

- Every production browser route checks a verified session and scopes data by its user ID; every connector route checks the bound device token and account identity.
- Website and connector keep MT5 and AI credentials out of browser storage, source files, public assets, and logs.
- The website displays the last broker observation time, connector status, trading mode, limits, and a reason when new entries are blocked.
- The connector and MT5 must remain running on the user's PC for automatic trading. A website pause blocks new commands, while an offline connector cannot manage an existing broker position.
- Migrations, build, TypeScript tests, Python tests, cross-user HTTP tests, and a clean-user browser flow pass for each release before it replaces the public download.

## External setup needed for launch

The operator must configure a production Cloudflare Worker/D1 origin, a transactional email sender with a verified domain, AI provider keys and spending controls, and a Windows code-signing certificate. Users provide their own MT5 and broker accounts. The existing public `.exe` is an unsigned read-only connector and must not be described as the live release.
