# Native MT5 MCP setup and verification

## Local terminal

1. Open MetaTrader 5 on the same Windows PC as the connector. Sign in to the intended FxPro account and confirm the terminal reports a broker connection.
2. In **Tools > Options > MCP**, enable the internal server and use **Copy** to obtain the current terminal endpoint and API key. The usual endpoint is `http://127.0.0.1:22346/mcp`; the terminal's configured address is authoritative. Keep it bound to loopback.
3. Enter that endpoint and key into the connector window. The key is saved in Windows Credential Manager. The connector uses the official Python MCP SDK over Streamable HTTP, calls MT5's `get_workspace_info` pre-flight, discovers capabilities, and invokes only `get_trading_account_info` and `get_trading_open_positions` for snapshot sync.
4. If the terminal is disconnected or identity fields are missing, the connector reports an error and does not upload a snapshot. A tool-discovery success alone does not prove account binding.

[Official MT5 configuration](https://www.metatrader5.com/en/terminal/help/mcp_and_ai/configuration) and [capability list](https://www.metatrader5.com/en/terminal/help/mcp_and_ai/capabilities) are the source of truth. MT5 can change its available tools and schemas; the connector checks discovered input schemas before use.

## Codex MCP configuration

No project `.codex/config.toml` existed during this integration. The repo includes [.codex/config.toml.example](../.codex/config.toml.example) with only the terminal endpoint enabled. In MT5, use **Tools > Options > MCP > Copy**, then put its generated Codex terminal block into `.codex/config.toml` in this project. Replace the example address if MT5 uses a different loopback port. Keep the generated Bearer key local; `.codex/config.toml` is ignored by Git. Restart Codex and check the terminal server in **Settings > Plugins > MCPs**. Enable MetaEditor or marketdata only when those capabilities are needed and their separate keys and permissions have been reviewed.

The connector's key and Codex's key can refer to the same MT5 terminal endpoint, but neither belongs in frontend code, `.dev.vars`, a URL, or documentation. Rotate any key that was exposed. The hosted Worker cannot call a Windows loopback address; it receives snapshots only from a paired outbound connector request.

## Website pairing

Run `npm run db:migrate:local` for local development. For staging or production, apply migration `0009_connector_pairing.sql` to the intended D1 database before deploying the Worker. Sign in as the configured owner, open **Accounts**, create a one-time code, and paste it into the connector. Use HTTPS for any hosted website. The connector stores the returned device token in Windows Credential Manager; the Worker stores only a SHA-256 digest. The first valid account snapshot binds broker, server, login, account type, and currency to that device. Revoke and re-pair after an account switch.

The website shows last-observed time and stale status. It never claims a snapshot is a live stream. No order tool is used by this integration.

## Verification and current limits

Run `npm test -- --run`, `npm run build`, and from the project root `connector/.venv/Scripts/python.exe -m unittest discover -s connector/tests -v`. The local terminal handshake was verified with the configured key and reported 107 tools, but its broker connection was disconnected at the time of testing. Read-only account response fields were inspected without printing credentials or login identifiers. A real FxPro snapshot, nonempty open-position mapping, remote pairing, and the packaged connector executable still require validation.
