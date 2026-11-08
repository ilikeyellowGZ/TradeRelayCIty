TradeRelayCity Connector for Windows - read-only preview

1. Extract the entire TradeRelayCity-Connector folder from this ZIP.
2. Install and sign in to MetaTrader 5 on the same Windows PC, using a demo account.
3. In MT5, open Tools > Options > MCP. Enable the internal server and copy its
   local address and API key. Keep the address on 127.0.0.1.
4. Run TradeRelayCity-Connector.exe from the extracted folder. Enter the MT5
   endpoint and API key, save local settings, then select Test connection
   (read only).

The API key is stored in Windows Credential Manager. Do not put it in the
website's .dev.vars file or share it in a screenshot.

This preview cannot pair with the website or submit broker orders. Live
trading is disabled. Closing the connector does not close MT5 positions.
