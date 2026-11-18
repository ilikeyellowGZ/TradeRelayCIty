TradeRelayCity Connector for Windows - read-only MT5 account snapshots

1. Download TradeRelayCity-Connector-Windows.exe and open the app.
2. Install and sign in to MetaTrader 5 on the same Windows PC. Confirm its
   broker connection is active. A demo account is recommended for validation.
3. In MT5, open Tools > Options > MCP. Enable the internal server and copy its
   local address and API key. Keep the address on 127.0.0.1.
4. In the connector window, enter the MT5
   endpoint and API key, save local settings, then select Test connection
   (read only).
5. Sign in to the TradeRelayCity website as the owner. Open Accounts and create
   a one-time pairing code. Paste it into this connector and select Pair this
   device within 10 minutes.
6. Select Sync MT5 snapshot (read only). The first valid snapshot binds this
   device to the displayed broker account. Resume automatic sync to retry every
   15 seconds while the connector and terminal are running. Pause to stop reads.

The API key is stored in Windows Credential Manager. Do not put it in the
website's .dev.vars file or share it in a screenshot.

This connector cannot submit broker orders. Demo and live order execution are
disabled. Closing the connector does not close MT5 positions. The website
shows the last snapshot time; stale values must not be treated as current.
