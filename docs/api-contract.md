# API contract (current simulation subset)

All timestamps are UTC ISO 8601. Simulation endpoints require loopback host plus `SIMULATION_MODE=true`; they are not production authentication.

| Method | Path | Purpose | Current behavior |
|---|---|---|---|
| GET | `/api/health` | Liveness without secret disclosure | Returns service name and explicit simulated/live-off flags |
| GET | `/api/simulation/session` | Current fixture persona and personas | Local-only; `x-simulation-user` selects one of three fixtures |
| GET | `/api/simulation/accounts` | Accounts belonging to selected fixture | Owner-filtered D1 query |
| GET | `/api/simulation/accounts/{id}/overview` | Scoped account, positions, commands, decision and events | Account owner enforced in SQL; same 404 for absent/foreign account |
| POST | `/api/simulation/commands/{id}/transition` | Advance a simulated command state | Owner-filtered conditional D1 update; valid transition graph; no broker operation |
| GET/POST | `/api/auth/*` | Better Auth endpoints | Passkey plugin mounted; production requires `APP_BASE_URL`, `BETTER_AUTH_SECRET`, and the official generated auth schema before use |
| GET | `/api/invitations/validate?token=...` | Validate a one-time enrollment link | Hash lookup; returns display name and expiry only |
| POST | `/api/invitations` | Owner creates member invite | Requires passkey session, exact same-origin `Origin`, owner ID, hourly cap; raw link returned once, token hash stored |
| POST | `/api/simulation/ai/decision` | Request a fixture AI opinion | Local loopback simulation only; bounded schema, deterministic HOLD-only provider, per-fixture daily request quota, D1 usage ledger; never creates an order |
| POST | `/api/simulation/connector/poll` | Claim one pending HOLD fixture | Loopback simulation only; owner/account-scoped atomic claim; returns `brokerAction: NONE` |
| POST | `/api/simulation/connector/{id}/ack` | Acknowledge a claimed HOLD fixture | Loopback simulation only; accepts HOLD commands only and records `SIMULATION_ONLY_NO_BROKER_ACTION` |

The implemented command states are `pending`, `claimed`, `submitting`, `filled`, `partially_filled`, `rejected`, `expired`, `cancelled`, and `unknown`. Expired commands cannot be claimed or submitted. Repeating the current state is idempotent. API requests are parameterized and owner-scoped. The device pairing, production connector poll/claim, recovery, history, export, and emergency-control contracts remain to be implemented before production deployment. The AI usage ledger currently supports simulation fixtures only; real provider requests are not routed by this API.
