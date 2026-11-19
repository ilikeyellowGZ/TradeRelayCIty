# Set up your TradeRelayCity workspace

TradeRelayCity uses one shared website. Each person creates their own account and pairs their own Windows connector to their own MT5 terminal. The current release shows read-only MT5 snapshots; automatic trading and live orders are not enabled yet.

1. Open the TradeRelayCity website and choose **Create your account**. Enter your name, username, and a password with at least 12 characters. No email address is needed.
2. Save the eight recovery codes shown after signup in a password manager or another private place. They are shown only once. A code can reset your password if you forget it. If you lose both your password and codes, the account cannot be recovered automatically. Sign in on the website after saving the codes.
3. On the same Windows PC, install MetaTrader 5, sign in to your own broker account, and confirm the broker, server, login, and whether the account is DEMO or LIVE. Start with a demo account for this preview.
4. In MT5, open **Tools > Options > MCP**, enable the terminal's internal server, and copy its local endpoint and Bearer key. Keep the endpoint on `127.0.0.1` or `localhost`; never expose it to the internet.
5. On the website, download **TradeRelayCity-Connector-Windows.exe**. Open it on the MT5 PC. The website URL should already be filled in. Enter the MT5 MCP endpoint and Bearer key, then select **Save local settings** and **Test connection (read only)**. The key is stored in Windows Credential Manager.
6. In the signed-in website, open **Accounts** and create a one-time pairing code. Paste it into the connector and select **Pair this device**. Then select **Sync MT5 snapshot (read only)**. Confirm the website shows your own broker/server/login, account type, balance, equity, positions, and observation time. You can resume automatic snapshot sync while the connector remains open.

The website account and MT5 login are separate. Never enter your broker password into TradeRelayCity. In the workspace, open **Security** to replace your recovery codes using your current password; new codes invalidate every old code. If the connector reports HTTP 401, copy the current terminal Bearer key from MT5 again without the `Bearer ` prefix. A stale snapshot or disconnected status means the displayed values are not current.

Your PC, connector, and MT5 must remain running for snapshot updates. Sleep, reboot, logout, a closed terminal, or loss of internet pauses them. Closing the connector does not close any MT5 positions. The current connector never submits broker orders.
