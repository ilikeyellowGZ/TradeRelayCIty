# Security and credentials

## Credential placement

- MT5 MCP Bearer key: Windows Credential Manager on the connector PC.
- Connector device credential: Windows Credential Manager after pairing is implemented.
- AI provider key and `BETTER_AUTH_SECRET`: Cloudflare Worker secrets (`wrangler secret put ...`). Never use Vite `VITE_*` variables for secrets.
- Website owner password: entered through the local bootstrap prompt and stored in D1 as a Better Auth password hash; no plaintext password is stored in `.dev.vars`.
- D1 ID and binding name: `wrangler.jsonc`; database identifiers are not secret.
- Connector settings and SQLite recovery journal: `%LOCALAPPDATA%\TradeRelayCity`; no password/key in JSON or logs.

The connector store throws when Windows Credential Manager is unavailable. It does not fall back to plaintext. The committed config example contains no keys.

## Safety boundary today

Simulation routes require both local simulation configuration and a loopback request host. All synthetic accounts have `mode=SIMULATED` and `is_live=0` enforced by D1 check constraints. The Worker verifies the Better Auth session before serving `/app` and redirects unsigned requests to `/login`; the browser also checks the session before rendering the workspace. Production account data APIs still need session and database ownership checks; the simulation header is never an identity mechanism outside local development. The connector MCP adapter only enumerates approved read-only operations. Order, shell, file and arbitrary web tools are deny-listed and no trading call is implemented.

Live execution is disabled in code and configuration. Inserting secrets does not enable it. Real broker demo validation, verified MCP schemas, device pairing/revocation, and a reviewed live activation gate are still outstanding. Do not connect a real account to this incomplete connector.

## Operational notes

Do not expose the terminal's loopback MCP port through a router or tunnel. Do not log Authorization headers, API keys, website passwords, or full provider prompts. Do not treat a network timeout as a failed order; reconcile before retrying. MT5-side stops are independent; the connector cannot respond while Windows is asleep, logged out, or offline.
