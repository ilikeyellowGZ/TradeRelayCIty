# Windows connector development

The source package is in `connector/`. It provides a Tk setup window, protected local configuration, Windows Credential Manager storage, a SQLite command journal, and a read-only official MCP client. The connector currently does not pair with a deployed account and cannot submit broker orders.

## Build

Use Windows PowerShell and Python 3.14 x64 (the current build was produced with Python 3.14.5):

```powershell
Set-Location connector
./build-windows.ps1
```

The executable is emitted under `connector/dist/`. PyInstaller bundles Python; it does not install or configure MT5. The current development host has Python 3.14.5 only, so the 3.13 Windows package has not been built or smoke-tested here.

## Read-only MT5 MCP diagnostics

In MT5 inspect Tools > Options > MCP and copy the terminal's actual address and Bearer key. The example endpoint is `http://127.0.0.1:22346/mcp`, but the terminal settings are authoritative. Keep MCP loopback-only. Test connection calls `list_tools` and, only when the discovered schema requires no arguments, `get_trading_account_info`. It never invokes any `trade_*` operation. Reported tools are filtered to an explicit read-only allowlist; shell, file editing, filesystem and trading operations are blocked.

## Current limitations

Pairing, polling, capability-to-account binding, multi-instance lock, account rebinding, broker adapter execution and offline reconciliation still need implementation and tests. Do not enable broker demo or live execution. Closing the connector stops local work but does not close MT5 positions.
