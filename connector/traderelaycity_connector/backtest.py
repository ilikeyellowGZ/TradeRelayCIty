"""Small, event-driven research harness for user-supplied closed-bar CSV data.

CSV columns: timestamp (ISO-8601), open, high, low, close. All times must include
an offset or be UTC. Costs are expressed in instrument price units per round trip.
This is research tooling only; it has no broker or Worker dependencies.
"""
from __future__ import annotations

import argparse
import csv
import json
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path

from .strategy import Candle, CandidateSignal, evaluate_closed_bars


@dataclass(frozen=True)
class BacktestTrade:
    direction: str
    signal_time: str
    entry_time: str | None
    exit_time: str | None
    entry: float
    stop: float
    target: float
    exit_price: float | None
    result_r: float
    status: str


def _timestamp(raw: str) -> datetime:
    value = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("timestamps must include a UTC offset")
    return value


def read_candles(path: Path) -> list[Candle]:
    candles: list[Candle] = []
    with path.open(newline="", encoding="utf-8-sig") as stream:
        reader = csv.DictReader(stream)
        required = {"timestamp", "open", "high", "low", "close"}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError(f"{path}: expected columns {', '.join(sorted(required))}")
        for row in reader:
            candles.append(Candle(_timestamp(row["timestamp"]), *(float(row[k]) for k in ("open", "high", "low", "close"))))
    return candles


def _simulate(signal: CandidateSignal, future: list[Candle], spread: float, slippage: float, commission: float) -> BacktestTrade:
    risk = abs(signal.entry_context - signal.stop)
    if risk <= 0:
        return BacktestTrade(signal.direction, signal.setup_time.isoformat(), None, None, signal.entry_context, signal.stop, signal.target, None, 0, "invalid")
    entry_index = next((i for i, bar in enumerate(future[:signal.expires_after_bars]) if bar.low <= signal.entry_context <= bar.high), None)
    if entry_index is None:
        return BacktestTrade(signal.direction, signal.setup_time.isoformat(), None, None, signal.entry_context, signal.stop, signal.target, None, 0, "expired_unfilled")
    entry_bar = future[entry_index]
    exit_price: float | None = None
    status = "expired_open"
    exit_time: str | None = None
    for bar in future[entry_index:entry_index + signal.expires_after_bars]:
        if signal.direction == "BUY":
            stop_hit, target_hit = bar.low <= signal.stop, bar.high >= signal.target
        else:
            stop_hit, target_hit = bar.high >= signal.stop, bar.low <= signal.target
        # Conservative OHLC handling: if both boundaries occur in one bar, assume stop first.
        if stop_hit:
            exit_price, status = signal.stop, "stopped" if not target_hit else "both_touched_stop_assumed"
        elif target_hit:
            exit_price, status = signal.target, "target"
        if exit_price is not None:
            exit_time = bar.timestamp.isoformat()
            break
    if exit_price is None:
        last = future[min(len(future), entry_index + signal.expires_after_bars) - 1]
        exit_price, exit_time, status = last.close, last.timestamp.isoformat(), "time_exit"
    gross = (exit_price - signal.entry_context) if signal.direction == "BUY" else (signal.entry_context - exit_price)
    costs = max(0.0, spread) + max(0.0, slippage) * 2 + max(0.0, commission)
    return BacktestTrade(signal.direction, signal.setup_time.isoformat(), entry_bar.timestamp.isoformat(), exit_time, signal.entry_context, signal.stop, signal.target, exit_price, (gross - costs) / risk, status)


def run_backtest(m15: list[Candle], h1: list[Candle], symbol: str, *, spread: float = 0, slippage: float = 0, commission: float = 0) -> dict[str, object]:
    if not m15 or not h1:
        raise ValueError("both M15 and H1 datasets must contain candles")
    trades: list[BacktestTrade] = []
    seen: set[tuple[str, str, float]] = set()
    m15_index = {bar.timestamp: index for index, bar in enumerate(m15)}
    for current in range(99, len(m15) - 1):
        signal_time = m15[current].timestamp
        closed_h1 = [bar for bar in h1 if bar.timestamp <= signal_time]
        result = evaluate_closed_bars(symbol, m15[:current + 1], closed_h1)
        signal = result.signal
        if signal is None:
            continue
        key = (signal.direction, signal.setup_time.isoformat(), signal.entry_context)
        if key in seen:
            continue
        seen.add(key)
        setup_index = m15_index.get(signal.setup_time)
        if setup_index is None:
            continue
        expiry_index = min(len(m15), setup_index + signal.expires_after_bars + 1)
        trades.append(_simulate(signal, m15[current + 1:expiry_index], spread, slippage, commission))
    return {"strategy_version": "ict-baseline-v1", "symbol": symbol, "dataset": {"m15_bars": len(m15), "h1_bars": len(h1), "start": min(m15[0].timestamp, h1[0].timestamp).isoformat(), "end": m15[-1].timestamp.isoformat()}, "costs_price_units": {"spread_round_trip": spread, "slippage_per_side": slippage, "commission_round_trip": commission}, "trades": [asdict(trade) for trade in trades], "summary": _summary(trades)}


def _summary(trades: list[BacktestTrade]) -> dict[str, float | int]:
    values = [trade.result_r for trade in trades if trade.entry_time is not None]
    equity, peak, drawdown = 0.0, 0.0, 0.0
    for value in values:
        equity += value
        peak = max(peak, equity)
        drawdown = max(drawdown, peak - equity)
    return {"signals": len(trades), "filled": len(values), "net_r": round(sum(values), 4), "mean_r": round(sum(values) / len(values), 4) if values else 0.0, "max_drawdown_r": round(drawdown, 4)}


def main() -> None:
    parser = argparse.ArgumentParser(description="Research-only, closed-bar TradeRelayCity backtest")
    parser.add_argument("--m15", required=True, type=Path)
    parser.add_argument("--h1", required=True, type=Path)
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--spread", type=float, default=0, help="round-trip price units")
    parser.add_argument("--slippage", type=float, default=0, help="price units per side")
    parser.add_argument("--commission", type=float, default=0, help="round-trip price units")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = run_backtest(read_candles(args.m15), read_candles(args.h1), args.symbol, spread=args.spread, slippage=args.slippage, commission=args.commission)
    text = json.dumps(report, indent=2)
    if args.output:
        args.output.write_text(text + "\n", encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
