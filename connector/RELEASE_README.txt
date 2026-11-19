TradeRelayCity Connector for Windows - MT5 snapshots and guarded DEMO bot

1. Open TradeRelayCity-Connector-Windows.exe and sign in to a connected MT5
   DEMO account on the same Windows PC.
2. In MT5, open Tools > Options > MCP. Enable the internal server, then copy
   the local address and API key to the connector. Keep the address on 127.0.0.1.
3. Save settings and select Test connection (read only).
4. Sign in to the TradeRelayCity website as the owner. Open Accounts, create
   a one-time pairing code, paste it into the connector, and pair this device.
5. Sync an MT5 snapshot. The first valid snapshot binds this device to the
   displayed broker account. Automatic snapshot sync retries every 15 seconds.
6. Run one demo bot cycle with the arm box clear to inspect HOLD/READY status.
   To permit an actual EURUSD DEMO order, set MT5's AI Assistant > Trading
   permission to allow trades, arm demo orders in the connector for this
   session, and run a cycle. Optional 15-minute watch repeats while armed.
7. Select Sign out and disconnect to stop automatic activity, revoke this
   device's website pairing, and remove its saved device and MT5 keys. Wait
   for a running sync or demo cycle to finish before signing out.

The bot requires a closed-bar strategy setup, server AI approval, current
broker quote, verified positive loss and margin calculations, order check,
risk-sized volume, and a protective stop. It allows one entry per UTC day.
No condition guarantees an order will be placed. Check MT5 Trade and History
for broker-confirmed results and stop protection. If the connector reports
UNKNOWN, inspect MT5 before trying again. Closing the connector does not
close any MT5 position.

Live-account entries remain disabled. The MCP key and paired device token
are stored in Windows Credential Manager, not in website settings.
