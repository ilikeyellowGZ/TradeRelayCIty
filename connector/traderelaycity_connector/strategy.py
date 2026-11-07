"""Closed-bar ICT-inspired candidate filter. It only returns context; it submits nothing."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from math import isfinite
from typing import Literal

Direction = Literal["BUY", "SELL"]

@dataclass(frozen=True)
class Candle:
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float

@dataclass(frozen=True)
class CandidateSignal:
    direction: Direction
    symbol: str
    entry_context: float
    stop: float
    target: float
    setup_time: datetime
    expires_after_bars: int
    rationale: str

@dataclass(frozen=True)
class Evaluation:
    signal: CandidateSignal | None
    reason: str

def validate_bars(bars: list[Candle]) -> str | None:
    previous = None
    for bar in bars:
        values = (bar.open, bar.high, bar.low, bar.close)
        if not all(isfinite(value) for value in values): return "non-finite OHLC value"
        if bar.high < max(bar.open, bar.close, bar.low) or bar.low > min(bar.open, bar.close, bar.high): return "invalid OHLC range"
        if previous is not None and bar.timestamp <= previous: return "duplicate or non-monotonic candle timestamps"
        previous = bar.timestamp
    return None

def atr(bars: list[Candle], period: int = 14) -> list[float | None]:
    if period < 1: raise ValueError("ATR period must be positive")
    tr: list[float] = []
    for index, bar in enumerate(bars):
        tr.append(bar.high - bar.low if index == 0 else max(bar.high - bar.low, abs(bar.high - bars[index - 1].close), abs(bar.low - bars[index - 1].close)))
    out: list[float | None] = [None] * len(bars)
    if len(tr) < period: return out
    value = sum(tr[:period]) / period
    out[period - 1] = value
    for index in range(period, len(tr)):
        value = (value * (period - 1) + tr[index]) / period
        out[index] = value
    return out

def confirmed_swings(bars: list[Candle], left: int = 2, right: int = 2) -> tuple[list[tuple[int, float]], list[tuple[int, float]]]:
    highs, lows = [], []
    for pivot in range(left, len(bars) - right):
        window = bars[pivot - left : pivot + right + 1]
        if bars[pivot].high == max(bar.high for bar in window) and sum(bar.high == bars[pivot].high for bar in window) == 1:
            highs.append((pivot, bars[pivot].high))
        if bars[pivot].low == min(bar.low for bar in window) and sum(bar.low == bars[pivot].low for bar in window) == 1:
            lows.append((pivot, bars[pivot].low))
    return highs, lows

def higher_timeframe_bias(bars: list[Candle]) -> Direction | None:
    highs, lows = confirmed_swings(bars)
    if len(highs) < 2 or len(lows) < 2: return None
    high_rising = highs[-1][1] > highs[-2][1]
    low_rising = lows[-1][1] > lows[-2][1]
    high_falling = highs[-1][1] < highs[-2][1]
    low_falling = lows[-1][1] < lows[-2][1]
    if high_rising and low_rising: return "BUY"
    if high_falling and low_falling: return "SELL"
    return None

def evaluate_closed_bars(symbol: str, signal_bars: list[Candle], higher_bars: list[Candle]) -> Evaluation:
    if (problem := validate_bars(signal_bars)) or (problem := validate_bars(higher_bars)):
        return Evaluation(None, problem)
    if len(signal_bars) < 100 or len(higher_bars) < 100:
        return Evaluation(None, "at least 100 closed bars per timeframe are required")
    if not symbol.strip(): return Evaluation(None, "broker symbol mapping is missing")
    bias = higher_timeframe_bias(higher_bars)
    if bias is None: return Evaluation(None, "higher-timeframe swing structure is neutral or unconfirmed")
    values = atr(signal_bars)
    highs, lows = confirmed_swings(signal_bars)
    current = len(signal_bars) - 1
    recent_start = max(0, current - 8)
    candidates: list[CandidateSignal] = []

    if bias == "BUY":
        eligible_lows = [(index, price) for index, price in lows if index < recent_start]
        if eligible_lows:
            _, swing_low = eligible_lows[-1]
            for sweep in range(recent_start, current - 2):
                if signal_bars[sweep].low >= swing_low or signal_bars[sweep].close <= swing_low: continue
                for displacement in range(sweep + 1, current - 1):
                    bar, volatility = signal_bars[displacement], values[displacement]
                    if volatility is None or bar.close <= bar.open: continue
                    if bar.close - bar.open < 1.2 * volatility or bar.close < bar.low + .75 * (bar.high - bar.low): continue
                    third = signal_bars[displacement + 2]
                    gap = third.low - bar.high
                    if gap < .1 * volatility: continue
                    entry = (third.low + bar.high) / 2
                    stop = swing_low - .1 * volatility
                    risk = entry - stop
                    if risk <= 0: continue
                    candidates.append(CandidateSignal("BUY", symbol, entry, stop, entry + 2 * risk, signal_bars[displacement + 2].timestamp, 8, "Bullish H1 structure, confirmed M15 sweep, displacement and closed-bar FVG."))
                    break
                if candidates: break
    else:
        eligible_highs = [(index, price) for index, price in highs if index < recent_start]
        if eligible_highs:
            _, swing_high = eligible_highs[-1]
            for sweep in range(recent_start, current - 2):
                if signal_bars[sweep].high <= swing_high or signal_bars[sweep].close >= swing_high: continue
                for displacement in range(sweep + 1, current - 1):
                    bar, volatility = signal_bars[displacement], values[displacement]
                    if volatility is None or bar.close >= bar.open: continue
                    if bar.open - bar.close < 1.2 * volatility or bar.close > bar.low + .25 * (bar.high - bar.low): continue
                    third = signal_bars[displacement + 2]
                    gap = bar.low - third.high
                    if gap < .1 * volatility: continue
                    entry = (third.high + bar.low) / 2
                    stop = swing_high + .1 * volatility
                    risk = stop - entry
                    if risk <= 0: continue
                    candidates.append(CandidateSignal("SELL", symbol, entry, stop, entry - 2 * risk, signal_bars[displacement + 2].timestamp, 8, "Bearish H1 structure, confirmed M15 sweep, displacement and closed-bar FVG."))
                    break
                if candidates: break
    if len(candidates) > 1: return Evaluation(None, "competing directions are ambiguous")
    if not candidates: return Evaluation(None, "no fully confirmed sweep, displacement and FVG candidate")
    return Evaluation(candidates[0], "candidate requires separate broker, session and risk approval")
