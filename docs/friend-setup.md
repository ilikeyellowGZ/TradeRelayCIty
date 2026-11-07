# TradeRelayCity setup for a friend

This is a guide for a future tested release. The current connector is an early read-only preview and is not ready for broker execution.

1. Install and sign in to your own MetaTrader 5 terminal and connect your own broker demo account.
2. In MT5 open Tools > Options > MCP. Confirm the MCP server is enabled and inspect its exact loopback URL. Do not expose it to the internet.
3. Install TradeRelayCity Connector when a Windows package is published. Enter the TradeRelayCity site address.
4. Enter the MCP endpoint from MT5. Paste the MCP Bearer key from the terminal into the connector's secure field; it should be saved in Windows Credential Manager.
5. Choose **Test connection (read only)**. Confirm broker, server, account number, currency, and demo status before a future account-binding flow.
6. Leave the app paused until the reviewed demo setup is delivered. Never enter a broker password into TradeRelayCity.

Your PC and MT5 need to be running for local automation. Sleep, reboot, logout, a closed terminal, or loss of internet pauses the connector. Existing broker-side stops may remain with the broker. They are not a guarantee against slippage or gaps.
