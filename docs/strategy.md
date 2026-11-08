# TradeRelayCity baseline strategy (version 0.1.0)

This document defines a deterministic, educational ICT-inspired baseline. It is a signal specification, not a claim of profitability. The local simulation remains `SIMULATED`; no entry is sent to a broker.

## Data and defaults

- Market scope: forex currency pairs and cryptocurrencies. The first strategy example is `EURUSD`; `BTCUSD` appears only as a synthetic blocked-attempt fixture. The connector must verify the exact broker symbol, instrument category, contract size, tick values, account-currency conversion, sessions and order capabilities before enabling any pair. Metals, indices and other instruments are outside this scope. Cryptocurrency execution remains unavailable in this build.
- Signal timeframe: M15. Higher-timeframe context: H1. Only fully closed bars are eligible.
- ATR length: 14 using Wilder smoothing. Swing confirmation: two bars on each side. A swing at index `i` is confirmed only after bars `i+1` and `i+2` close.
- Displacement: body size at least `1.2 × ATR(14)` and close in the outer 25% of the candle range in the direction of the body.
- Fair value gap: three closed candles. Bullish gap exists when candle 3 low is above candle 1 high; bearish gap when candle 3 high is below candle 1 low. Gap size must be at least `0.1 × ATR`.
- Retracement entry: midpoint (50%) of the displacement-created gap. A setup expires after 8 closed M15 bars if not touched.
- Stop buffer: `0.1 × ATR` beyond the swept swing. Target: 2R, where `R` is the entry-to-stop distance. No dynamic risk increase.

## Candidate sequence

1. Reject bars with missing, duplicated, non-monotonic or stale timestamps; require 100 closed M15 bars and 100 closed H1 bars. H1 availability uses the last H1 bar whose close timestamp is at or before the M15 decision time.
2. Determine H1 bias from the most recent pair of confirmed H1 swing highs and lows. Higher high + higher low is bullish; lower high + lower low is bearish; otherwise neutral. Neutral blocks a directional candidate.
3. In the last 8 closed M15 bars, require price to pierce the most recent confirmed M15 swing in the direction opposite the H1 bias and close back through that swing. A bullish bias requires a sweep below a confirmed swing low; bearish requires a sweep above a confirmed swing high.
4. After the sweep, require a same-direction displacement candle meeting the ATR and close-location thresholds. The candle must close after the sweep; no look-ahead is used.
5. Require a three-candle FVG created by the displacement candle and the following two closed candles. If those two later bars have not closed, no signal exists. For bullish setups, `third.low - displacement.high` must be at least `0.1 × ATR`; bearish setups use the mirrored `displacement.low - third.high`. The FVG midpoint is the entry context.
6. Invalidate if price closes beyond the swept swing plus/minus the stop buffer, the market is closed, the candidate is older than 8 bars, spread exceeds configured maximum, or the account/quote snapshot is stale.
7. Only a deterministic candidate may be sent for a mock/real AI opinion. `HOLD`, malformed output, unavailable AI, unsupported instrument data, or any failed risk check means no entry.

## Competing candidates

If bullish and bearish candidates appear in the same completed-bar evaluation, reject both as ambiguous. If multiple same-direction candidates qualify, keep the newest fully confirmed candidate; never use a future bar to choose. This is a heuristic filter, not a calibrated probability.

## Risk and session preconditions

Execution requires exact broker symbol metadata, account currency conversion, tick size/value, volume step, minimum/maximum volume, stop/freeze levels, spread, margin, and supported filling mode. The strategy alone cannot establish these. Until the read-only MCP diagnostics verify them, entry execution remains disabled. Session and holiday calendars are not guessed; unavailable session data blocks new entries.

The default local fixture intentionally returns `HOLD`. `config/strategy.example.json` contains the numerical settings used here.

## CSV backtest harness

`python -m traderelaycity_connector.backtest` consumes user-provided M15 and H1 CSV files with offset-aware ISO-8601 timestamps and OHLC columns. At each M15 close, the H1 input is filtered to bars whose close timestamp is no later than that decision timestamp. A setup can only fill on a subsequent M15 bar, and its 8-bar expiry is measured from the setup timestamp. If the same OHLC bar touches stop and target, stop is assumed first. Spread, two-sided slippage and commission are configurable price-unit costs. The runner reports trade count, filled count, net/mean R and max drawdown in R.

This harness is not a broker-feed replay: it does not model bid/ask series, swaps, variable contract sizing, calendar/session closures, or saved AI decisions. Use chronological training, validation and held-out datasets and compare with broker-demo forward results. No bundled dataset or expected performance is provided.
