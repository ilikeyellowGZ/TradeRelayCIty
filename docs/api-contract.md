# API contract (current simulation subset)

All timestamps are UTC ISO 8601. Simulation endpoints require loopback host plus `SIMULATION_MODE=true`; they are not production authentication.

| Method | Path | Purpose | Current behavior |
|---|---|---|---|
| GET | `/api/health` | Liveness without secret disclosure | Returns service name and explicit simulated/live-off flags |
| GET | `/api/simulation/session` | Current fixture persona and personas | Local-only; `x-simulation-user` selects one of three fixtures |
| GET | `/api/simulation/accounts` | Accounts belonging to selected fixture | Owner-filtered D1 query |
| GET | `/api/simulation/accounts/{id}/overview` | Scoped account, positions, commands, decision and events | Account owner enforced in SQL; same 404 for absent/foreign account |
| GET | `/api/simulation/accounts/{id}/trade-history?view=executed&limit={n}&cursor={cursor}` | Read account-scoped simulated outcomes and attempts | `view` is `executed` or `attempts`; owner/account scoped; max 50 rows; newest first; UTC; filters include date, symbol, direction, strategy, environment, status, outcome, and broker/internal ID search |
| GET | `/api/simulation/accounts/{id}/trade-history/{outcomeId}` | Read the latest immutable outcome version and evidence | Owner/account scoped; same 404 for absent/foreign account or outcome; never writes to the command ledger |
| GET | `/api/simulation/accounts/{id}/trade-history/export.csv` | Export filtered simulated history | Owner/account scoped; max 1,000 rows; fixed allowlist of columns; formula-leading text neutralized |
| POST | `/api/simulation/commands/{id}/transition` | Advance a simulated command state | Owner-filtered conditional D1 update; valid transition graph; no broker operation |
| GET/POST | `/api/auth/get-session`, `/api/auth/sign-in/username`, `/api/auth/sign-out` | Owner website session | Username/password only; no public sign-up, email sign-in, passkey or authenticator route; requires `APP_BASE_URL`, `BETTER_AUTH_SECRET`, and migration 0008 |
| POST | `/api/simulation/ai/decision` | Request a fixture AI opinion | Local loopback simulation only; bounded schema, deterministic HOLD-only provider, per-fixture daily request quota, D1 usage ledger; never creates an order |
| GET/POST | `/api/simulation/chat?accountId={id}` | List or create a simulated account conversation | Loopback-only; persona from validated simulation context; account owner checked; 90-day retention |
| GET/DELETE | `/api/simulation/chat/{id}` | Read or delete a simulated conversation | Owner-scoped; messages cascade on delete; maximum 50 listed conversations and 100 messages per conversation |
| POST | `/api/simulation/chat/{id}/messages` | Store a message and return a deterministic grounded answer | Same-origin mutation; max 2,000 characters; separate 20/day chat quota; account-scoped reads; no provider or action tools |
| POST | `/api/simulation/connector/poll` | Claim one pending HOLD fixture | Loopback simulation only; owner/account-scoped atomic claim; returns `brokerAction: NONE` |
| POST | `/api/simulation/connector/{id}/ack` | Acknowledge a claimed HOLD fixture | Loopback simulation only; accepts HOLD commands only and records `SIMULATION_ONLY_NO_BROKER_ACTION` |

The implemented command states are `pending`, `claimed`, `submitting`, `filled`, `partially_filled`, `rejected`, `expired`, `cancelled`, and `unknown`. Expired commands cannot be claimed or submitted. Repeating the current state is idempotent. API requests are parameterized and owner-scoped. Production connector poll/claim, recovery, broker history import, outcome finalization, and emergency-control contracts remain to be implemented before production deployment. The AI usage ledger currently supports simulation fixtures only; real provider requests are not routed by this API.

Trade History returns a versioned `TradeOutcomeV1` read model with fill, timeline, and evidence arrays. The simulation fixtures cover closed outcomes and attempted entries; they do not represent real MT5/FxPro deals. Net P&L uses the stored inclusive broker-style net when present; otherwise it is calculated from gross P&L minus all known charges exactly once. Cross-currency totals are not converted.

The chat routes above are local simulation fixtures, not authenticated production account chat. They are disabled outside loopback `SIMULATION_MODE=true`. They answer only from current simulated account snapshots, positions, commands, and decisions; reconciled trade history, learning, broker capabilities, production provider calls, and order actions are unavailable.
