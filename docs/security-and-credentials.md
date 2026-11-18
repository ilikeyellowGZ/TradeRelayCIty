# Security and credentials

## Credential placement

- MT5 MCP Bearer key: Windows Credential Manager on the connector PC.
- Connector device credential: Windows Credential Manager after pairing; D1 stores only its SHA-256 digest.
- AI provider key and `BETTER_AUTH_SECRET`: Cloudflare Worker secrets (`wrangler secret put ...`). Never use Vite `VITE_*` variables for secrets.
- Website owner password: entered through the local bootstrap prompt and stored in D1 as a Better Auth password hash; no plaintext password is stored in `.dev.vars`.
- D1 ID and binding name: `wrangler.jsonc`; database identifiers are not secret.
- Connector settings and SQLite recovery journal: `%LOCALAPPDATA%\TradeRelayCity`; no password/key in JSON or logs.

The connector store throws when Windows Credential Manager is unavailable. It does not fall back to plaintext. The committed config and Codex examples contain no real keys. The redundant `MT5_API_KEY` line was removed from local `.dev.vars` after confirming the same key was already in Credential Manager.

## Safety boundary today

Simulation routes require both local simulation configuration and a loopback request host. All synthetic accounts have `mode=SIMULATED` and `is_live=0` enforced by D1 check constraints. The Worker verifies the Better Auth session before serving `/app` and redirects unsigned requests to `/login`; the browser also checks the session before rendering the workspace. Production account data APIs still need session and database ownership checks; the simulation header is never an identity mechanism outside local development. The connector MCP adapter only enumerates approved read-only operations. Order, shell, file and arbitrary web tools are deny-listed and no trading call is implemented.

Live execution is disabled in code and configuration. Inserting secrets does not enable it. Owner pairing/revocation and read-only snapshot routes are implemented. Real broker snapshot validation, nonempty position response verification, remote staging, and a reviewed execution gate are still outstanding. The connector may read a real account but has no order-submission path.

## Operational notes

Do not expose the terminal's loopback MCP port through a router or tunnel. Do not log Authorization headers, API keys, website passwords, or full provider prompts. Do not treat a network timeout as a failed order; reconcile before retrying. MT5-side stops are independent; the connector cannot respond while Windows is asleep, logged out, or offline.
