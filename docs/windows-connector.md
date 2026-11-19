# Windows connector development

The source package is in `connector/`. It provides a Tk setup window, protected local configuration, Windows Credential Manager storage, a SQLite command journal, and a read-only official MCP client. The source and public Windows app support per-user pairing and read-only snapshot upload. The connector cannot submit broker orders.

## Build

Use Windows PowerShell, Node.js, and Python 3.14 x64 (the current build was produced with Python 3.14.5). Install the repository's npm dependencies first:

```powershell
npm ci
Set-Location connector
./build-windows.ps1 -WebsiteUrl https://traderelaycity.service-heyywebb.workers.dev
```

The executable is emitted under `connector/release-dist/` and copied to `public/downloads/TradeRelayCity-Connector-Windows.exe`. Pass the exact deployed HTTPS origin to `-WebsiteUrl`; the build embeds it as the connector's first-run default. PyInstaller bundles Python; it does not install or configure MT5.

## Website download

The public landing page has a **Download app for Windows** button. It downloads `TradeRelayCity-Connector-Windows.exe` directly without a website login or ZIP extraction. The executable and its window use the web app's candlestick logo. This is a read-only connector, not an installer.

To refresh the website download after connector changes, rebuild and then build the website from the project root:

```powershell
Set-Location connector
./build-windows.ps1 -WebsiteUrl https://traderelaycity.service-heyywebb.workers.dev
Set-Location ..
npm run build
```

The packaging script checks the executable copy and enforces Cloudflare's 25 MiB static-asset limit. Keep the connector's MT5 API key in the connector window on your PC, never in `.dev.vars` or the download. The release executable is currently unsigned, so Windows Smart App Control may block it until a trusted code signature is added.

## Read-only MT5 MCP diagnostics

1. Install and sign in to MetaTrader 5 on the same Windows PC as the connector. Use a broker demo account for this preview.
2. In MT5, open **Tools > Options > MCP**, enable **internal server**, keep the address on `127.0.0.1`, and copy the terminal endpoint and API key. The example endpoint is `http://127.0.0.1:22346/mcp`, but the terminal settings are authoritative. See [MetaTrader's MCP configuration guide](https://www.metatrader5.com/en/terminal/help/mcp_and_ai/configuration).
3. Download `TradeRelayCity-Connector-Windows.exe` from the website and open it. For development on this PC, run `./.venv/Scripts/python.exe ./connector_launcher.py` from `connector/`.
4. In the connector window, enter the website URL, the exact MT5 MCP endpoint and the copied Bearer key. Select **Save local settings**, then **Test connection (read only)**. The key is stored in Windows Credential Manager. Review the returned account information in MT5; the connector still labels account binding unconfirmed.

The test initializes the official MCP Python SDK, calls MT5's required `get_workspace_info` pre-flight, discovers tools, and reads `get_trading_account_info` only when its discovered schema requires no arguments. Snapshot sync also reads `get_trading_open_positions`. It never invokes a `trade_*` operation. Reported tools are filtered to an explicit read-only allowlist.

If the test reports **HTTP 401**, MT5 rejected the saved key. In **Tools > Options > MCP**, copy the current key for the **terminal** endpoint and paste only the token into the connector's Bearer key field (omit `Bearer `). Save and retry. The connector does not read `MT5_API_KEY` from `.dev.vars`. If the MCP tab or internal server is missing, update MT5 and confirm the internal server is enabled before retrying. After downloading an updated app, close the old connector before launching the new executable.

## 2026-11-18 read-only pairing update

The source connector now pairs with the owner through `/api/connector/pair` and stores its device token in Windows Credential Manager. The owner creates a one-time code from **Accounts** in the signed-in website. Apply migrations `0009_connector_pairing.sql`, `0010_broker_account_metrics.sql`, and `0011_connector_status.sql` before using these routes. After pairing, **Sync MT5 snapshot (read only)** reads the terminal's account and open-position tools and uploads a bounded snapshot with balance, equity, used/free margin, MT5-reported floating profit, and positions to `/api/connector/snapshot`. **Resume automatic sync** retries every 15 seconds while the connector is open; **Pause automatic sync** stops future reads. The setting persists across connector restarts. The connector reports `MCP_OFFLINE`, `MCP_ERROR`, or `PAUSED` using its device token; a validated upload marks it `SYNCED`. The website shows the latest state and recent connection transitions.

The connector runs MT5's required `get_workspace_info` pre-flight before its other tool calls. A disconnected terminal, missing broker identity, unknown account type, or changed broker/server/login blocks upload. The website shows the last observation time and labels stale values. The public executable was rebuilt after this update and its integrity and built-site hash were checked. Its executable has not yet been launched interactively.

Pairing and snapshot upload are source-implemented and locally tested; remote staging and a connected broker account have not been verified end to end. Open-position field mapping has only synthetic test coverage because the local terminal currently reports no open positions. Pending orders, closed deals, execution commands, broker reconciliation, and Strategy Tester jobs are not connected. Demo and live order execution stay disabled. Closing the connector stops local work but does not close MT5 positions.
