# Staging connector validation — 2026-11-18

## Verified

- The owner reported that the existing username and password open the staging workspace. A separate temporary remote auth probe verified wrong-password rejection, sign-in, session lookup, protected `/app`, sign-out, and redirect after sign-out; the probe account was removed.
- Staging runs with `SIMULATION_MODE=false`, D1 migration 0009 applied, and unauthenticated broker/device APIs returning 401. The local simulation API returns 404 remotely.
- A staging-only one-time pairing code was inserted directly into D1 for an exchange smoke test. The real `/api/connector/pair` endpoint consumed it, created one active device, and the device token was saved in Windows Credential Manager. The code and token were not printed. This proves exchange and storage; it does not prove the owner browser's Create pairing code button end to end.
- The connector's outbound client sets `User-Agent: TradeRelayCity-Connector/0.1`. Before this change, Cloudflare returned HTTP 403 with error 1010 for Python's default `urllib` user agent. A focused regression test covers the header. See [Cloudflare's error 1010 guide](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/).
- The rebuilt staging EXE containing that header was downloaded over HTTPS and its SHA-256 matched the build package (`1688e15eeeec12187200a910455beb3efa8389fdc8ea9954276648457f4889b0`). Windows Application Control blocks launching the unsigned EXE on this PC; the Python source connector runs here.
- The local MT5 MCP server responds at `http://127.0.0.1:22346/mcp` using the saved MCP key. Read-only tool discovery and schema inspection succeeded. No trading tool was invoked.
- The isolated demo state machine tests cover risk denial, required stop, exact risk-sized volume, idempotency collision, concurrent commands, timeout/unknown outcome, no replay, exact binding, and partial/full reconciliation. It is not connected to a production command queue or MT5 trading adapter.

## Blocked validation

- MT5's last `get_trading_account_info` response reported account type `real` and broker connection `disconnected`. The terminal then closed, leaving port 22346 unavailable. The collector correctly refused upload. Staging has no broker account or snapshot row. The owner needs to reopen the terminal and make its MCP account report `demo` and `connected` before broker data or demo order validation can proceed.
- The owner browser's pairing-code creation and the downloaded EXE's interactive launch have not been verified end to end. The local source connector was pointed at staging and the real exchange was validated with a staging-only seeded code.
- Demo order execution, broker-side stop acceptance, broker history reconciliation, command leases, and AI decision provenance have not been tested against a connected demo account. Entry execution remains disabled; live trading is disabled.
