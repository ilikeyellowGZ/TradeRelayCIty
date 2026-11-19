# MT5 demo bot test

The Windows connector has a guarded, local EURUSD demo bot. The website Trading page lets you save account-bound variants of its sweep/displacement/FVG setup and activate one. AI can draft the bounded settings from your description; you review, save, and activate the result. The connector checks fully closed M15 and H1 bars against the active setup, asks the configured Worker AI provider to approve an exact candidate, and sizes a market order using MT5's account-currency profit and margin calculations. The AI cannot choose a different symbol, side, entry, stop, target, or volume. The local risk engine makes the final decision.

## Setup

1. Sign in to an **MT5 DEMO** account in the Windows terminal. Keep MT5 running and connected. The connector rejects real, read-only, disconnected, or switched accounts.
2. In MT5, open **Tools > Options > MCP**, enable the internal server, and copy the local address and API key into the connector. Keep the MCP address on `127.0.0.1`. In **Tools > Options > AI Assistant**, set **Trading** to allow trades for the demo test; MT5 can also require confirmation, but an unattended bot cycle may time out while waiting for it. The terminal itself decides whether MCP trade tools may run.
3. Pair the connector from the signed-in website and sync one snapshot. The Worker must have migrations `0013_broker_demo_decisions.sql` and `0016_broker_demo_strategies.sql` applied and a supported `AI_PROVIDER`/`AI_MODEL` with its server-side key configured.
4. On the website, open **Trading**. Select the paired DEMO account. Describe your setup and click **Draft with AI**, or fill the four rule fields manually. Review the settings, click **Save strategy draft**, then **Activate** under Saved strategies. AI drafting can only adjust the supported EURUSD sweep/FVG template; unsupported ideas are not executable.
5. Install the latest connector download from the website. Click **Run one demo bot cycle** with the arm checkbox clear. This reads data and checks the active strategy. `HOLD` means no complete setup or no active strategy; `READY` means the candidate passed checks but no order was sent.
6. For an order test, select **Arm EURUSD DEMO orders for this session** and click **Run one demo bot cycle**. To keep checking while the connector stays open, select **Run the demo bot every 15 minutes while armed**. Both checkboxes reset when the app closes.

From the source checkout, PowerShell can run a dry cycle with:

```powershell
$env:PYTHONPATH = 'connector'
& .\connector\.venv\Scripts\python.exe -m traderelaycity_connector.demo_bot
```

Add `--arm-demo --watch` for an armed 15-minute loop. The GUI and CLI share the local `demo-bot.sqlite` journal in `%LOCALAPPDATA%\TradeRelayCity`.

## Guardrails and outcomes

- Only the exact broker symbol `EURUSD` can be entered. Live-account execution is disabled in code. A saved strategy is never active automatically; an unactivated or deactivated strategy produces `HOLD`. The bot rejects stale quotes, missing bars, existing positions or orders, prior broker trades on the same UTC day, unsupported symbol and filling settings, absent broker-side stops, and missing AI approval.
- MT5 must return a positive account-currency stop loss estimate and margin estimate. A zero, missing, or inconsistent value blocks entry. Risk is capped at 0.5% of equity per trade; volume is rounded down to the broker step. The bot permits at most one entry per UTC day and one open position.
- An approved order includes a broker-side stop and target. A local SQLite intent is written before the one order submission. A timeout or ambiguous broker response stays `UNKNOWN` and blocks further entries until broker history is reconciled. A reported fill is not considered settled until the position's protective stop is verified. If the stop cannot be verified, inspect and manage the MT5 position immediately.
- A successful AI opinion, order check, or request acknowledgment is **not** proof of a fill. Verify the order, position, stop, and deal in MT5's Trade and History tabs. Closing the connector does not close a position; the broker-side stop remains independent of the connector.

## Current validation boundary

The source path and mocked execution tests cover the decision route, sizing, denial, idempotency, unknown outcomes, and reconciliation. After MT5's AI Trading setting was saved, its non-submitting EURUSD order check succeeded and returned a positive projected margin. Its separate margin calculator and tick-size field still returned zero, so the connector uses the positive checked margin, account-currency profit estimate, and symbol point for sizing; it repeats the order check at the final volume. The connected demo account currently has four open USDJPY positions, which block a new bot entry. An armed cycle returned `HOLD` because no complete setup existed. **No broker demo fill has been verified.** MT5's MCP open-position response omits stop-loss and take-profit fields, so post-fill stop protection cannot yet be independently confirmed through that response; inspect MT5 immediately if an order outcome is `UNKNOWN`. The cloud command queue and broker-reconciled website trade history are still separate future work; this demo bot executes locally and records AI opinions in D1.
