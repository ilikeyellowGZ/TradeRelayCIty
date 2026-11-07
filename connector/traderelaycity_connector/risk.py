"""Deterministic pre-trade risk checks. This module calculates permission only; it submits no orders."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_DOWN

D = Decimal
LIVE_ENTRY_EXECUTION_ENABLED = False

@dataclass(frozen=True)
class AccountRisk:
    environment: str
    currency: str
    equity: Decimal
    day_start_equity: Decimal
    peak_equity: Decimal
    open_risk: Decimal
    pending_risk: Decimal
    open_positions: int
    entries_today: int
    snapshot_age_seconds: Decimal

@dataclass(frozen=True)
class ContractSpec:
    symbol: str
    account_currency: str
    tick_size: Decimal
    tick_value_account_currency: Decimal
    volume_min: Decimal
    volume_max: Decimal
    volume_step: Decimal
    minimum_stop_distance: Decimal
    freeze_distance: Decimal
    margin_per_lot: Decimal

@dataclass(frozen=True)
class Candidate:
    symbol: str
    side: str
    entry: Decimal
    stop: Decimal
    requested_volume: Decimal
    spread: Decimal
    expected_slippage: Decimal
    available_margin: Decimal
    ai_approved: bool
    deterministic_candidate: bool
    account_bound: bool
    broker_stop_protection: bool
    market_session_open: bool

@dataclass(frozen=True)
class RiskLimits:
    entries_enabled: bool = False
    allowed_symbols: tuple[str, ...] = ("EURUSD",)
    maximum_risk_per_trade_fraction: Decimal = D("0.005")
    maximum_total_risk_fraction: Decimal = D("0.02")
    maximum_daily_loss_fraction: Decimal = D("0.02")
    maximum_drawdown_fraction: Decimal = D("0.10")
    maximum_volume: Decimal = D("1.00")
    maximum_positions: int = 3
    maximum_entries_per_day: int = 5
    maximum_spread: Decimal = D("0.00030")
    maximum_expected_slippage: Decimal = D("0.00020")
    maximum_market_data_age_seconds: Decimal = D("5")

@dataclass(frozen=True)
class RiskDecision:
    allowed: bool
    volume: Decimal | None
    risk_amount: Decimal | None
    reasons: tuple[str, ...]

def _floor_step(value: Decimal, step: Decimal) -> Decimal:
    return (value / step).to_integral_value(rounding=ROUND_DOWN) * step

def evaluate_candidate(candidate: Candidate, account: AccountRisk, contract: ContractSpec, limits: RiskLimits) -> RiskDecision:
    reasons: list[str] = []
    if not limits.entries_enabled: reasons.append("new entries are disabled")
    if account.environment == "LIVE" and not LIVE_ENTRY_EXECUTION_ENABLED: reasons.append("live entry execution is disabled in this build")
    elif account.environment not in {"DEMO", "SIMULATED"}: reasons.append("unknown account environment")
    if not candidate.account_bound: reasons.append("broker account binding is unconfirmed")
    if candidate.symbol != contract.symbol or candidate.symbol not in limits.allowed_symbols: reasons.append("exact broker symbol mapping is missing or not allowed")
    if contract.account_currency != account.currency: reasons.append("contract tick value is not in the account currency")
    if not candidate.deterministic_candidate: reasons.append("no confirmed deterministic setup")
    if not candidate.ai_approved: reasons.append("AI approval is absent")
    if not candidate.broker_stop_protection: reasons.append("required broker-side stop protection is unavailable")
    if not candidate.market_session_open: reasons.append("instrument session is closed or unknown")
    if account.snapshot_age_seconds > limits.maximum_market_data_age_seconds: reasons.append("market/account snapshot is stale")
    if candidate.spread < 0 or candidate.spread > limits.maximum_spread: reasons.append("spread exceeds the configured limit")
    if candidate.expected_slippage < 0 or candidate.expected_slippage > limits.maximum_expected_slippage: reasons.append("expected slippage exceeds the configured limit")
    if account.equity <= 0 or account.day_start_equity <= 0 or account.peak_equity <= 0: reasons.append("equity baseline is missing or invalid")
    if account.open_risk < 0 or account.pending_risk < 0: reasons.append("open or pending risk is invalid")
    if account.equity > 0 and account.day_start_equity > 0 and (account.day_start_equity - account.equity) / account.day_start_equity >= limits.maximum_daily_loss_fraction:
        reasons.append("daily equity loss limit reached")
    if account.equity > 0 and account.peak_equity > 0 and (account.peak_equity - account.equity) / account.peak_equity >= limits.maximum_drawdown_fraction:
        reasons.append("account drawdown limit reached")
    if account.open_positions >= limits.maximum_positions: reasons.append("maximum open positions reached")
    if account.entries_today >= limits.maximum_entries_per_day: reasons.append("maximum daily entries reached")
    if candidate.side not in {"BUY", "SELL"}: reasons.append("unsupported order side")
    stop_distance = candidate.entry - candidate.stop if candidate.side == "BUY" else candidate.stop - candidate.entry
    if stop_distance <= 0: reasons.append("stop is on the wrong side of the entry or has zero distance")
    if contract.tick_size <= 0 or contract.tick_value_account_currency <= 0 or contract.volume_step <= 0:
        reasons.append("verified tick size, account-currency tick value, and volume step are required")
    if contract.volume_min <= 0 or contract.volume_max < contract.volume_min or contract.margin_per_lot < 0:
        reasons.append("broker volume or margin specification is invalid")
    if stop_distance > 0 and stop_distance < max(contract.minimum_stop_distance, contract.freeze_distance):
        reasons.append("stop violates broker stop/freeze distance")
    if reasons:
        return RiskDecision(False, None, None, tuple(reasons))

    risk_per_lot = ((stop_distance + candidate.expected_slippage) / contract.tick_size) * contract.tick_value_account_currency
    if risk_per_lot <= 0:
        return RiskDecision(False, None, None, ("computed risk per lot is invalid",))
    per_trade_budget = account.equity * limits.maximum_risk_per_trade_fraction
    total_budget = max(D("0"), account.equity * limits.maximum_total_risk_fraction - account.open_risk - account.pending_risk)
    margin_volume = candidate.available_margin / contract.margin_per_lot if contract.margin_per_lot > 0 else candidate.requested_volume
    raw_volume = min(candidate.requested_volume, limits.maximum_volume, contract.volume_max, per_trade_budget / risk_per_lot, total_budget / risk_per_lot, margin_volume)
    volume = _floor_step(raw_volume, contract.volume_step)
    if volume < contract.volume_min:
        return RiskDecision(False, None, None, ("minimum broker volume exceeds risk, exposure, or available-margin budget",))
    risk_amount = risk_per_lot * volume
    return RiskDecision(True, volume, risk_amount, ())
