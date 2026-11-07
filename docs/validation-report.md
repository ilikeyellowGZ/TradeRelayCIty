# Validation report

Updated 7 November 2026. Local checks validate simulation and build boundaries only. No provider, remote Cloudflare, or broker credentials were used.

## Passed

- `npm test`: 9 tests passed across simulation isolation/command-state and mock/provider-output boundary checks.
- `npm run build`: TypeScript and Cloudflare Worker/client production bundles completed. Cloudflare Vite emitted non-fatal upstream Zod annotation warnings and a notice that `auth-client.ts` is both dynamically and statically imported. The post-build cleanup removed `dist/traderelaycity/.dev.vars`; the output check returned absent.
- `connector\.venv\Scripts\python.exe -m unittest discover -s connector\tests -v`: 10 tests passed, covering loopback MCP and simulation-client validation, forbidden-tool exclusion, journal idempotency, sizing limits, stale data, live-entry denial, swing confirmation and conservative stop-first backtest handling.
- Local D1 migrations `0001_simulation.sql` through `0004_ai_usage.sql` applied in the prior run. The local API smoke checks confirmed `SIMULATED` / `isLive=false`, owner-scoped fixture account data, foreign-account 404, unauthenticated Better Auth session response, invalid-invitation response, HOLD-only mock decision and quota-exhaustion 429.
- Local simulation connector end-to-end smoke: inserted a transient pending HOLD command into local D1; the Python client claimed and acknowledged it; API returned `SIMULATION_ONLY_NO_BROKER_ACTION`, `SIMULATED`, and `isLive=false`.
- Windows PyInstaller application-directory build succeeded with Python 3.14.5. This was not an installer test or an interactive runtime test.

## Not verified

- Passkey ceremony and invitation flow in a browser, responsive/keyboard visual checks, device pairing, session revocation, recovery, and cross-user authenticated actions.
- Any real OpenAI/Anthropic/xAI API request or provider-specific model schema. Adapter code is not routed by the API; real keys were not supplied.
- Backtest results on market data. The report has no bundled dataset; its only automated check covers a candle touching both stop and target.
- Windows Credential Manager read/write with a disposable secret; connector GUI runtime; actual MT5 MCP endpoint, tools, account metadata, broker binding, or FxPro contract specs.
- Cloud connector polling/pairing/claims, lease/fencing, broker command execution, submission-timeout reconciliation, partial-fill management, and remote deployment.
- Worker CPU and D1 consumption under three actual users.

## Needed from the owner later

1. Create/sign into a Cloudflare account, create the D1 database, choose the production origin and replace the placeholder database ID. Follow [Cloudflare deployment](cloudflare-deployment.md).
2. After passkey flows are completed and checked, set `BETTER_AUTH_SECRET` in Wrangler and use the owner bootstrap command against remote D1.
3. Select an AI provider/model and provide its API key through Wrangler secrets only after authenticated provider routing, atomic usage controls and real-provider tests are implemented.
4. Arrange the friend's Windows MT5/FxPro demo setup and local MCP endpoint/key for read-only capability/account checks. Keep broker execution in demo validation only and live entries disabled.
5. Provide broker contract/cost data and historical M15/H1 datasets if you want meaningful risk and strategy evaluation.
