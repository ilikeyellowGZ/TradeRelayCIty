"""Owner-armed, EURUSD-only demo bot. A failed check means no order."""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal as D
from pathlib import Path

from .broker_snapshot import _payload, normalize_mt5_snapshot
from .cloud_client import CloudClient
from .demo_execution import DemoCommand, DemoExecutor, ExecutionOutcome, ReconciliationEvidence
from .journal import Journal
from .mcp_adapter import validate_local_endpoint
from .risk import AccountRisk, Candidate, ContractSpec, RiskLimits, evaluate_candidate
from .strategy import Candle, CandidateSignal, StrategyConfig, evaluate_closed_bars

SYMBOL = "EURUSD"
STRATEGY_VERSION = "0.1.0"
REQUIRED_TOOLS = frozenset({
    "get_trading_account_info", "get_trading_open_positions", "get_trading_history_orders",
    "get_marketwatch_symbols", "get_chart_history", "trade_order_calc_profit",
    "trade_order_calc_margin", "trade_check_market_order", "trade_send_market_order", "get_time_information",
})


class DemoBotBlocked(RuntimeError):
    pass


def _decimal(value, label: str, positive: bool = False) -> D:
    if isinstance(value, bool):
        raise DemoBotBlocked(f"{label} is invalid")
    try:
        number = D(str(value))
    except (TypeError, ValueError, ArithmeticError):
        raise DemoBotBlocked(f"{label} is invalid") from None
    if not number.is_finite() or (positive and number <= 0):
        raise DemoBotBlocked(f"{label} is invalid")
    return number


def _utc(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (AttributeError, TypeError, ValueError):
        raise DemoBotBlocked("MT5 time is invalid") from None
    # MT5 chart and quote times are terminal UTC times without an offset.
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)


def _binding(snapshot: dict) -> str:
    account = snapshot["account"]
    return "|".join((account["broker"], account["server"], account["login"]))


def _quote_utc(quote_time: str, time_info: dict) -> datetime:
    """Market Watch times are server-local; chart bars are UTC in this MT5 MCP build."""
    reported_utc = _utc(time_info.get("utc_time"))
    server_time = time_info.get("trade_server_last_known_time")
    if not isinstance(server_time, str):
        raise DemoBotBlocked("MT5 server time is unavailable")
    server_local = datetime.fromisoformat(server_time)
    quote_local = datetime.fromisoformat(quote_time)
    if server_local.tzinfo is not None or quote_local.tzinfo is not None:
        raise DemoBotBlocked("MT5 quote time format changed")
    offset = server_local - reported_utc.replace(tzinfo=None)
    if abs(offset.total_seconds()) > 14 * 3600:
        raise DemoBotBlocked("MT5 server time offset is invalid")
    return (quote_local - offset).replace(tzinfo=timezone.utc)


def _bars(payload: dict, period_minutes: int, now: datetime) -> list[Candle]:
    if payload.get("ok") is not True or not isinstance(payload.get("history"), list):
        raise DemoBotBlocked("MT5 chart history is unavailable")
    bars = []
    for item in payload["history"]:
        if not isinstance(item, dict):
            raise DemoBotBlocked("MT5 chart bar is invalid")
        started = _utc(item.get("time"))
        if started + timedelta(minutes=period_minutes) > now:
            continue
        bars.append(Candle(started, *(float(_decimal(item.get(field), f"bar {field}", True)) for field in ("open", "high", "low", "close"))))
    if len(bars) < 100 or now - bars[-1].timestamp > timedelta(minutes=period_minutes * 2):
        raise DemoBotBlocked("Closed market bars are missing or stale")
    return bars[-120:]


class McpDemoBroker:
    def __init__(self, endpoint: str, key: str):
        validate_local_endpoint(endpoint)
        if not key:
            raise DemoBotBlocked("MT5 MCP key is missing")
        self.endpoint, self.key = endpoint, key
        self._http = self._transport = self._session = None
        self.tools: dict[str, dict] = {}

    async def __aenter__(self):
        import httpx2
        from mcp import ClientSession
        from mcp.client.streamable_http import streamable_http_client

        self._http = httpx2.AsyncClient(headers={"Authorization": f"Bearer {self.key}"}, timeout=httpx2.Timeout(10, read=15))
        await self._http.__aenter__()
        try:
            self._transport = streamable_http_client(self.endpoint, http_client=self._http)
            read, write, *_ = await self._transport.__aenter__()
            self._session = ClientSession(read, write)
            await self._session.__aenter__()
            await self._session.initialize()
            _payload(await self._session.call_tool("get_workspace_info", {}), "workspace")
            listing = await self._session.list_tools()
            self.tools = {tool.name: tool.input_schema for tool in listing.tools}
            if not REQUIRED_TOOLS <= self.tools.keys():
                raise DemoBotBlocked("Required MT5 demo tools are unavailable")
            return self
        except BaseException as error:
            try:
                await self.__aexit__(type(error), error, error.__traceback__)
            except BaseException:
                pass
            if isinstance(error, DemoBotBlocked):
                raise
            raise DemoBotBlocked("MT5 MCP connection failed; open the terminal, confirm its local MCP server and key, then retry") from None

    async def __aexit__(self, exc_type, exc, traceback):
        try:
            if self._session is not None:
                await self._session.__aexit__(exc_type, exc, traceback)
        finally:
            try:
                if self._transport is not None:
                    try:
                        await self._transport.__aexit__(exc_type, exc, traceback)
                    except BaseExceptionGroup:
                        if exc is None:
                            raise DemoBotBlocked("MT5 MCP connection was interrupted") from None
            finally:
                if self._http is not None:
                    await self._http.__aexit__(exc_type, exc, traceback)

    async def _call(self, name: str, args: dict) -> dict:
        if name not in self.tools:
            raise DemoBotBlocked(f"MT5 {name} is unavailable")
        return _payload(await self._session.call_tool(name, args), name)

    async def _checked_order(self, payload: dict) -> dict | None:
        check = await self._call("trade_check_market_order", {key: value for key, value in payload.items() if key != "comment"})
        result = check.get("result")
        if check.get("ok") is not True or not isinstance(result, dict) or result.get("retcode") != 0:
            return None
        try:
            margin = _decimal(result.get("margin"), "checked margin", True)
            margin_free = _decimal(result.get("margin_free"), "checked free margin")
        except DemoBotBlocked:
            return None
        return result if margin_free >= 0 and margin > 0 else None

    async def snapshot(self) -> dict:
        info = await self._call("get_trading_account_info", {})
        trades = await self._call("get_trading_open_positions", {})
        snapshot = normalize_mt5_snapshot(info, trades)
        if snapshot["account"]["environment"] != "DEMO" or info["account"].get("read_only") is not False or info["terminal"].get("mcp_trade_allowed") is not True:
            raise DemoBotBlocked("Connected writable DEMO account with MT5 MCP trading enabled is required")
        return snapshot

    async def chart_bars(self, period: str, now: datetime) -> list[Candle]:
        minutes = {"M15": 15, "H1": 60}[period]
        result = await self._call("get_chart_history", {
            "datetime_from": (now - timedelta(days=16)).isoformat(), "datetime_to": now.isoformat(),
            "symbol": SYMBOL, "period": period, "limit": 150,
        })
        return _bars(result, minutes, now)

    async def _context(self, signal: CandidateSignal, approved: bool, requested_volume: D) -> tuple[str, AccountRisk, ContractSpec, Candidate]:
        now = datetime.now(timezone.utc)
        snapshot = await self.snapshot()
        if snapshot["positions"]:
            raise DemoBotBlocked("Existing broker positions require manual review before a demo entry")
        trades = await self._call("get_trading_open_positions", {})
        if trades.get("orders") != []:
            raise DemoBotBlocked("Existing broker orders require manual review")
        history = await self._call("get_trading_history_orders", {
            "datetime_from": now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat(),
            "datetime_to": (now + timedelta(minutes=1)).isoformat(), "limit": 100,
        })
        if not isinstance(history.get("orders"), list) or not isinstance(history.get("deals"), list):
            raise DemoBotBlocked("Broker trade history is unavailable")
        if history["orders"] or history["deals"]:
            raise DemoBotBlocked("Only one demo entry is allowed per UTC day, including other MT5 trades")
        market = await self._call("get_marketwatch_symbols", {"symbol": SYMBOL})
        symbols = market.get("symbols")
        if not isinstance(symbols, list) or len(symbols) != 1 or symbols[0].get("symbol") != SYMBOL:
            raise DemoBotBlocked("Exact EURUSD broker symbol is unavailable")
        item = symbols[0]
        if item.get("trade_mode_name") != "full" or not isinstance(item.get("trade_order_mode"), int) or not item["trade_order_mode"] & 16:
            raise DemoBotBlocked("Broker market orders with stop protection are unavailable")
        if item.get("trade_filling_mode") not in (1, 2, 3):
            raise DemoBotBlocked("Broker filling mode is unsupported")
        quote_time = _quote_utc(item.get("update_time"), await self._call("get_time_information", {}))
        quote_age = D(str((now - quote_time).total_seconds()))
        if quote_age < -1 or quote_age > 5:
            raise DemoBotBlocked("Broker quote is stale")
        quote_age = max(D(0), quote_age)
        bid, ask = _decimal(item.get("bid"), "bid", True), _decimal(item.get("ask"), "ask", True)
        if ask <= bid:
            raise DemoBotBlocked("Broker quote spread is invalid")
        entry = ask if signal.direction == "BUY" else bid
        if abs(entry - D(str(signal.entry_context))) > D("0.00010"):
            raise DemoBotBlocked("Price has not retraced to the strategy entry")
        point = _decimal(item.get("point"), "point", True)
        tick_size = _decimal(item.get("tick_size"), "tick size")
        stop = D(str(signal.stop))
        adverse_close = stop - D("0.00005") if signal.direction == "BUY" else stop + D("0.00005")
        loss = await self._call("trade_order_calc_profit", {
            "symbol": SYMBOL, "type": signal.direction.lower(), "volume": 1.0,
            "price_open": float(entry), "price_close": float(adverse_close),
        })
        margin = await self._call("trade_order_calc_margin", {
            "symbol": SYMBOL, "type": signal.direction.lower(), "volume": 1.0, "price": float(entry),
        })
        currency = snapshot["account"]["currency"]
        if loss.get("ok") is not True or margin.get("ok") is not True or loss.get("currency") != currency or margin.get("currency") != currency:
            raise DemoBotBlocked("Broker account-currency risk calculations are unavailable")
        per_lot_loss = -_decimal(loss.get("profit"), "one-lot stop loss")
        per_lot_margin = _decimal(margin.get("margin"), "one-lot margin")
        if per_lot_loss <= 0:
            raise DemoBotBlocked("Broker returned zero or invalid loss; entry blocked")
        minimum_volume = _decimal(item.get("volume_min"), "minimum volume", True)
        if tick_size <= 0 or per_lot_margin <= 0:
            checked = await self._checked_order({
                "symbol": SYMBOL, "type": signal.direction.lower(), "volume": float(minimum_volume),
                "sl": float(stop), "tp": float(signal.target),
            })
            if checked is None:
                raise DemoBotBlocked("Broker tick size or margin is unavailable and the minimum order check failed")
            if per_lot_margin <= 0:
                per_lot_margin = _decimal(checked.get("margin"), "checked margin", True) / minimum_volume
            if tick_size <= 0:
                # This broker reports zero tick size. The point is only a sizing unit;
                # the broker check above verifies that the actual stop is accepted.
                tick_size = point
        distance = abs(entry - stop) + D("0.00005")
        tick_value = per_lot_loss * tick_size / distance
        stop_level = _decimal(item.get("trade_stops_level"), "stop level") * point
        freeze_level = _decimal(item.get("trade_freeze_level"), "freeze level") * point
        contract = ContractSpec(SYMBOL, currency, tick_size, tick_value,
                                minimum_volume,
                                _decimal(item.get("volume_max"), "maximum volume", True),
                                _decimal(item.get("volume_step"), "volume step", True),
                                stop_level, freeze_level, per_lot_margin)
        equity = _decimal(snapshot["account"]["equity"], "equity", True)
        account = AccountRisk("DEMO", currency, equity, equity, equity, D(0), D(0), 0, 0, quote_age)
        candidate = Candidate(SYMBOL, signal.direction, entry, stop, requested_volume, ask - bid,
                              D("0.00005"), _decimal(snapshot["account"]["marginFree"], "free margin"),
                              approved, True, True, True, True)
        return _binding(snapshot), account, contract, candidate

    async def size(self, signal: CandidateSignal) -> D:
        _, account, contract, candidate = await self._context(signal, True, D("1"))
        decision = evaluate_candidate(candidate, account, contract, RiskLimits(entries_enabled=True, maximum_positions=1, maximum_entries_per_day=1))
        if not decision.allowed or decision.volume is None:
            raise DemoBotBlocked("; ".join(decision.reasons))
        return decision.volume

    async def preflight(self, command: DemoCommand):
        if not hasattr(self, "signal") or not hasattr(self, "approved_decision_id") or command.decision_id != self.approved_decision_id:
            raise DemoBotBlocked("Approved AI decision is missing")
        return await self._context(self.signal, True, command.requested_volume)

    async def check_market_order(self, payload: dict) -> bool:
        await self.snapshot()
        return await self._checked_order(payload) is not None

    async def send_market_order(self, payload: dict) -> dict:
        await self.snapshot()
        return await self._call("trade_send_market_order", payload)

    async def reconcile(self, command: DemoCommand) -> ReconciliationEvidence | None:
        snapshot = await self.snapshot()
        if _binding(snapshot) != command.account_binding:
            return None
        now = datetime.now(timezone.utc)
        history = await self._call("get_trading_history_orders", {
            "datetime_from": (now - timedelta(days=1)).isoformat(),
            "datetime_to": (now + timedelta(minutes=1)).isoformat(),
            "symbol": SYMBOL, "limit": 1000, "include_orders_canceled": True,
        })
        orders, deals = history.get("orders"), history.get("deals")
        if not isinstance(orders, list) or not isinstance(deals, list):
            return None
        matches = [item for item in orders if isinstance(item, dict) and item.get("comment") == command.comment]
        if len(matches) != 1:
            return None
        order = matches[0]
        ticket = order.get("order_id", order.get("ticket"))
        if ticket in (None, "", 0):
            return None
        related = [item for item in deals if isinstance(item, dict) and str(item.get("order_id", item.get("order", ""))) == str(ticket)]
        volume = sum((_decimal(item.get("volume"), "deal volume") for item in related), D(0))
        rejected = str(order.get("state", "")).lower() in ("rejected", "canceled", "cancelled")
        protected = any(position["symbol"] == command.symbol and position["side"] == command.side and position["stop"] is not None and abs(D(str(position["stop"])) - command.stop) <= D("0.00001") for position in snapshot["positions"])
        return ReconciliationEvidence(command.account_binding, 1, volume, rejected, protected)


async def run_demo_cycle(cloud: CloudClient, token: str, endpoint: str, key: str, journal: Journal, arm_demo: bool) -> ExecutionOutcome:
    now = datetime.now(timezone.utc)
    async with McpDemoBroker(endpoint, key) as broker:
        snapshot = await broker.snapshot()
        receipt = await asyncio.to_thread(cloud.upload_snapshot, token, snapshot)
        if receipt.get("environment") != "DEMO" or not isinstance(receipt.get("accountId"), str):
            raise DemoBotBlocked("Paired cloud account is not the connected DEMO account")
        binding = _binding(snapshot)
        if journal.unresolved():
            for row in journal.unresolved():
                try:
                    intent = json.loads(row["intent_json"])
                    command = DemoCommand(row["command_id"], row["idempotency_key"], row["account_binding"],
                                          _utc(intent["expiresAt"]), intent["decisionId"], intent["symbol"],
                                          intent["side"], D(intent["volume"]), D(intent["stop"]),
                                          D(intent["target"]) if intent["target"] is not None else None)
                except (KeyError, TypeError, ValueError, ArithmeticError):
                    raise DemoBotBlocked("A previous command has invalid journal evidence") from None
                result = await DemoExecutor(journal, RiskLimits()).reconcile(command, broker)
                if result.status == "unknown":
                    raise DemoBotBlocked(result.reason or "A previous submission remains uncertain; review MT5 history before another entry")
        if journal.connection.execute("SELECT 1 FROM commands WHERE account_binding=? AND status IN ('filled','partially_filled') AND updated_at>=date('now') LIMIT 1", (binding,)).fetchone():
            return ExecutionOutcome("hold", "A demo entry has already filled for this account today")
        active_strategy = await asyncio.to_thread(cloud.active_demo_strategy, token, receipt["accountId"])
        if active_strategy is None:
            return ExecutionOutcome("hold", "Create and activate a DEMO strategy on the Trading page")
        try:
            strategy_config = StrategyConfig.from_cloud(active_strategy["config"])
        except (KeyError, ValueError, TypeError):
            raise DemoBotBlocked("Active DEMO strategy is invalid") from None
        signal_bars = await broker.chart_bars("M15", now)
        higher_bars = await broker.chart_bars("H1", now)
        evaluated = evaluate_closed_bars(SYMBOL, signal_bars, higher_bars, strategy_config)
        if evaluated.signal is None:
            return ExecutionOutcome("hold", evaluated.reason)
        signal = evaluated.signal
        if now - signal.setup_time > timedelta(minutes=signal.expires_after_bars * 15):
            return ExecutionOutcome("hold", "Strategy setup expired")
        request = {
            "accountId": receipt["accountId"], "snapshotId": snapshot["observedAt"],
            "strategyId": active_strategy["id"],
            "setupTime": signal.setup_time.isoformat(),
            "candidate": {"symbol": SYMBOL, "direction": signal.direction, "entry": signal.entry_context,
                          "stop": signal.stop, "target": signal.target, "strategyVersion": STRATEGY_VERSION},
            "marketSnapshot": {
                "signalBars": [{"time": b.timestamp.isoformat(), "open": b.open, "high": b.high, "low": b.low, "close": b.close} for b in signal_bars[-20:]],
                "higherBars": [{"time": b.timestamp.isoformat(), "open": b.open, "high": b.high, "low": b.low, "close": b.close} for b in higher_bars[-20:]],
            },
        }
        opinion = await asyncio.to_thread(cloud.request_demo_opinion, token, request)
        if not opinion["approved"] or opinion["decision"] != signal.direction or opinion["symbol"] != SYMBOL or _utc(opinion["expiresAt"]) <= datetime.now(timezone.utc):
            return ExecutionOutcome("hold", "AI did not approve the deterministic demo candidate")
        volume = await broker.size(signal)
        if not arm_demo:
            return ExecutionOutcome("ready", f"Demo candidate approved at {volume} lots; order submission is not armed")
        latest_strategy = await asyncio.to_thread(cloud.active_demo_strategy, token, receipt["accountId"])
        if latest_strategy is None or latest_strategy.get("id") != active_strategy["id"] or latest_strategy.get("config") != active_strategy["config"]:
            return ExecutionOutcome("hold", "Active DEMO strategy changed during this cycle")
        command_seed = f"{binding}|{SYMBOL}|{signal.direction}|{signal.setup_time.isoformat()}|{STRATEGY_VERSION}|{active_strategy['id']}"
        command_id = hashlib.sha256(command_seed.encode()).hexdigest()
        command = DemoCommand(command_id, command_id, binding,
                              min(_utc(opinion["expiresAt"]), datetime.now(timezone.utc) + timedelta(seconds=45)),
                              opinion["decisionId"], SYMBOL, signal.direction, volume, D(str(signal.stop)), D(str(signal.target)))
        broker.signal = signal
        broker.approved_decision_id = opinion["decisionId"]
        return await DemoExecutor(journal, RiskLimits(entries_enabled=True, maximum_positions=1, maximum_entries_per_day=1)).submit(command, broker)


def main() -> int:
    from .connector_flow import DEVICE_CREDENTIAL
    from .main import APP_DIR, MCP_CREDENTIAL, load_config
    from .secure_store import read_secret

    parser = argparse.ArgumentParser(description="Run the guarded EURUSD MT5 demo bot")
    parser.add_argument("--arm-demo", action="store_true", help="allow a broker DEMO order if every check passes")
    parser.add_argument("--watch", action="store_true", help="repeat at 15 minute intervals until stopped")
    args = parser.parse_args()
    config = load_config()
    token, key = read_secret(DEVICE_CREDENTIAL), read_secret(MCP_CREDENTIAL)
    if not token or not key:
        parser.error("pair the connector and save the MT5 MCP key first")
    APP_DIR.mkdir(parents=True, exist_ok=True)
    journal = Journal(Path(APP_DIR) / "demo-bot.sqlite")
    blocked = False
    try:
        while True:
            try:
                outcome = asyncio.run(run_demo_cycle(CloudClient(config["website_url"], timeout=30), token, config["mcp_url"], key, journal, args.arm_demo))
                print(json.dumps({"status": outcome.status, "reason": outcome.reason, "demoArmed": args.arm_demo}))
            except Exception as error:
                blocked = True
                print(json.dumps({"status": "blocked", "reason": str(error)[:240], "demoArmed": args.arm_demo}))
            if not args.watch:
                break
            time.sleep(900)
    finally:
        journal.close()
    return 1 if blocked and not args.watch else 0


if __name__ == "__main__":
    raise SystemExit(main())
