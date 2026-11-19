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
| GET/POST | `/api/auth/get-session`, `/api/auth/sign-in/username`, `/api/auth/sign-out` | Website account | Username/password sign-in; strict method/path allowlist and same-origin POST; email auth routes are closed |
| POST | `/api/account/register` | Public, same-origin | Creates username/password account and returns eight one-time recovery codes once; rate limited; no email address |
| POST | `/api/account/recover` | Public, same-origin | Consumes one recovery code, changes password, and revokes sessions atomically; rate limited |
| POST | `/api/account/recovery-codes/rotate` | Signed-in user, same-origin, current password | Replaces all existing codes and returns eight new codes once; rate limited |
| POST | `/api/simulation/ai/decision` | Request a fixture AI opinion | Local loopback simulation only; bounded schema, deterministic HOLD-only provider, per-fixture daily request quota, D1 usage ledger; never creates an order |
| GET/POST | `/api/simulation/chat?accountId={id}` | List or create a simulated account conversation | Loopback-only; persona from validated simulation context; account owner checked; 90-day retention |
| GET/DELETE | `/api/simulation/chat/{id}` | Read or delete a simulated conversation | Owner-scoped; messages cascade on delete; maximum 50 listed conversations and 100 messages per conversation |
| POST | `/api/simulation/chat/{id}/messages` | Store a message and return a deterministic grounded answer | Same-origin mutation; max 2,000 characters; separate 20/day chat quota; account-scoped reads; no provider or action tools |
| POST | `/api/simulation/connector/poll` | Claim one pending HOLD fixture | Loopback simulation only; owner/account-scoped atomic claim; returns `brokerAction: NONE` |
| POST | `/api/simulation/connector/{id}/ack` | Acknowledge a claimed HOLD fixture | Loopback simulation only; accepts HOLD commands only and records `SIMULATION_ONLY_NO_BROKER_ACTION` |

The implemented command states are `pending`, `claimed`, `submitting`, `filled`, `partially_filled`, `rejected`, `expired`, `cancelled`, and `unknown`. Expired commands cannot be claimed or submitted. Repeating the current state is idempotent. API requests are parameterized and owner-scoped. Production connector poll/claim, recovery, broker history import, outcome finalization, and emergency-control contracts remain to be implemented before production deployment. The AI usage ledger currently supports simulation fixtures only; real provider requests are not routed by this API.

Trade History returns a versioned `TradeOutcomeV1` read model with fill, timeline, and evidence arrays. The simulation fixtures cover closed outcomes and attempted entries; they do not represent real MT5/FxPro deals. Net P&L uses the stored inclusive broker-style net when present; otherwise it is calculated from gross P&L minus all known charges exactly once. Cross-currency totals are not converted.

The chat routes above are local simulation fixtures, not authenticated production account chat. They are disabled outside loopback `SIMULATION_MODE=true`. They answer only from current simulated account snapshots, positions, commands, and decisions; reconciled trade history, learning, broker capabilities, production provider calls, and order actions are unavailable.

## Read-only broker pairing, snapshots, and status (migrations 0009–0011)

| Method | Path | Authentication | Result |
|---|---|---|---|
| POST | `/api/broker/pairing-codes` | Verified user session and same-origin request | Creates a single-use 20-character code valid for 10 minutes; returns it once |
| GET | `/api/broker/devices` | Signed-in user session | Lists paired and revoked devices, their last-seen times and account identity |
| GET | `/api/broker/devices/{id}/events` | Signed-in user session | Lists the latest 25 connection state transitions for an owned device |
| DELETE | `/api/broker/devices/{id}` | Signed-in user session and same-origin request | Revokes a device token |
| GET | `/api/broker/accounts` | Signed-in user session | Lists user-bound latest account snapshots and `stale` flag |
| POST | `/api/broker/accounts/{id}/questions` | Signed-in user session and same-origin request | Returns a deterministic, read-only answer grounded in that account's latest snapshot; unsupported questions are declined |
| GET | `/api/broker/ai-capabilities` | Signed-in user session | Reports whether the optional server-side classifier is configured, without a key |
| POST | `/api/broker/accounts/{id}/ai-questions` | Signed-in user session and same-origin request | Classifies a question with the configured provider, then renders facts from the owned snapshot; 30 requests per UTC day |
| POST | `/api/connector/pair` | One-time code | Returns a device ID and 256-bit bearer token once |
| POST | `/api/connector/snapshot` | Device bearer token | Validates and stores an account/position snapshot; rejects changed account identity |
| POST | `/api/connector/status` | Device bearer token | Accepts `MCP_OFFLINE`, `MCP_ERROR`, or `PAUSED`; `SYNCED` can only be set by a validated snapshot upload |

The Worker stores token digests, not plaintext tokens. Pairing and snapshots are user/device scoped in D1. Snapshot uploads are bounded to 32 KiB, observed within the last 120 seconds, and contain no MCP or AI keys. The snapshot account contains balance, equity, used margin, free margin, and MT5-reported floating profit; positions remain a separate bounded array. Migration 0010 adds nullable columns for the three new metrics so older snapshots display an unavailable value until the next sync. The snapshot endpoint returns `mode: BROKER_READ_ONLY`. It never queues a trade. Broker values are snapshots, not a streaming feed; `stale` becomes true after 60 seconds. These routes have local unit/integration tests but no connected-broker or remote staging proof yet.

Migration 0011 stores the device's latest connector state and a bounded log of its last 100 state changes. Repeated identical reports refresh last-seen time without adding events. The status payload contains only a fixed state code, never an exception message or credential. A network outage cannot reach this endpoint, so the UI must still use snapshot age and last-seen time to detect silence.

The snapshot question route accepts at most 500 characters and returns `{answer, observedAt, stale, source: "MT5_ACCOUNT_SNAPSHOT", mode: "BROKER_READ_ONLY", supported}`. It answers balance, equity, margin, floating P&L, open positions, and account identity from the persisted snapshot. It does not call an AI provider, access local MCP, analyze market structure, or place orders. Questions needing broker history, strategy evidence, or contract details return `supported: false`.

The optional AI question route uses migration 0012 for a 30-request daily user cap. OpenAI, Anthropic, or xAI classifies only the question and available symbol names into a fixed intent schema. The Worker validates the intent and renders the answer from the same MT5 snapshot. It sends no account values to the provider and offers no execution tool. Provider calls and model compatibility remain unverified without a server-side key. See [classifier setup](broker-ai-classifier.md).
