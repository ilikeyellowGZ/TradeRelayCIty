# Windows connector development

The source package is in `connector/`. It provides a Tk setup window, protected local configuration, Windows Credential Manager storage, a SQLite command journal, and a read-only official MCP client. The connector currently does not pair with a deployed account and cannot submit broker orders.

## Build

Use Windows PowerShell and Python 3.14 x64 (the current build was produced with Python 3.14.5):

```powershell
Set-Location connector
./build-windows.ps1
```

The executable is emitted under `connector/dist/`. PyInstaller bundles Python; it does not install or configure MT5. The current development host has Python 3.14.5 only, so the 3.13 Windows package has not been built or smoke-tested here.

## Website download

The public landing page has a **Download for Windows** button. It downloads `TradeRelayCity-Connector-Windows.zip` without a website login. Extract the complete `TradeRelayCity-Connector` folder before opening `TradeRelayCity-Connector.exe`; the executable needs the adjacent `_internal` folder. The ZIP includes a short `README.txt` with the setup steps. This is a read-only preview, not an installer or a website-paired trading client.

To refresh the website download after connector changes, build a separate release folder and package it from the project root:

```powershell
Set-Location connector
.\.venv\Scripts\python.exe -m PyInstaller --noconfirm --clean --windowed --name TradeRelayCity-Connector --paths . --distpath release-dist --workpath release-build connector_launcher.py
Set-Location ..
.\connector\.venv\Scripts\python.exe .\connector\package_release.py
npm run build
```

The packaging script checks ZIP integrity, rejects credential files, and enforces the Cloudflare static-asset size limit. Keep the connector's MT5 API key in the connector window on your PC, never in `.dev.vars` or the download archive.

## Read-only MT5 MCP diagnostics

1. Install and sign in to MetaTrader 5 on the same Windows PC as the connector. Use a broker demo account for this preview.
2. In MT5, open **Tools > Options > MCP**, enable **internal server**, keep the address on `127.0.0.1`, and copy the terminal endpoint and API key. The example endpoint is `http://127.0.0.1:22346/mcp`, but the terminal settings are authoritative. See [MetaTrader's MCP configuration guide](https://www.metatrader5.com/en/terminal/help/mcp_and_ai/configuration).
3. Download and extract the Windows ZIP from the website, then run `TradeRelayCity-Connector.exe` from the extracted folder. For a source build, use `./build-windows.ps1` from `connector/` and run `./dist/TradeRelayCity-Connector/TradeRelayCity-Connector.exe`. The package is a folder, not an installer.
4. In the connector window, enter the website URL, the exact MT5 MCP endpoint and the copied Bearer key. Select **Save local settings**, then **Test connection (read only)**. The key is stored in Windows Credential Manager. Review the returned account information in MT5; the connector still labels account binding unconfirmed.

The test calls `list_tools` and, only when the discovered schema requires no arguments, `get_trading_account_info`. It never invokes any `trade_*` operation. Reported tools are filtered to an explicit read-only allowlist; shell, file editing, filesystem and trading operations are blocked.

If the test reports **HTTP 401**, MT5 rejected the saved key. In **Tools > Options > MCP**, copy the current key for the **terminal** endpoint and paste only the token into the connector's Bearer key field (omit `Bearer `). Save and retry. The connector does not read `MT5_API_KEY` from `.dev.vars`. If the MCP tab or internal server is missing, update MT5 and confirm the internal server is enabled before retrying. After downloading an updated ZIP, close the old connector and extract the new folder before launching it.

## Current limitations

Pairing, polling, capability-to-account binding, multi-instance lock, account rebinding, broker adapter execution and offline reconciliation still need implementation and tests. Do not enable broker demo or live execution. Closing the connector stops local work but does not close MT5 positions.
