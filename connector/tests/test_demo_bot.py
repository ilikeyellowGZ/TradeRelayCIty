from __future__ import annotations

import asyncio
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from datetime import datetime, timedelta, timezone
from decimal import Decimal as D

from traderelaycity_connector.demo_bot import DemoBotBlocked, McpDemoBroker, _bars, _quote_utc, run_demo_cycle
from traderelaycity_connector.demo_execution import DemoCommand, ReconciliationEvidence
from traderelaycity_connector.journal import Journal
from traderelaycity_connector.risk import AccountRisk, Candidate, ContractSpec
from traderelaycity_connector.strategy import Candle, CandidateSignal, Evaluation


class FakeMcpBroker(McpDemoBroker):
    def __init__(self):
        self.endpoint = "http://127.0.0.1:22346/mcp"
        self.key = "test-only"
        self.tools = {name: {} for name in (
            "get_trading_open_positions", "get_trading_history_orders", "get_marketwatch_symbols", "get_time_information",
            "trade_order_calc_profit", "trade_order_calc_margin", "trade_check_market_order",
        )}
        self.loss = -50
        self.tick_size = 0.0001
        self.calculated_margin = 1000
        self.check_result = {"ok": True, "result": {"retcode": 0, "margin": 0.52, "margin_free": 9999}}
        self.history = {"orders": [], "deals": []}
        self.permission = True
        self.calls = []

    async def snapshot(self):
        if not self.permission:
            raise DemoBotBlocked("Connected writable DEMO account required")
        return {"account": {"broker": "FxPro", "server": "FxPro-Demo", "login": "123", "environment": "DEMO", "currency": "USD", "equity": 10000, "marginFree": 10000}, "positions": []}

    async def _call(self, name, args):
        self.calls.append((name, args))
        if name == "get_trading_open_positions":
            return {"positions": [], "orders": []}
        if name == "get_trading_history_orders":
            return self.history
        if name == "get_marketwatch_symbols":
            return {"symbols": [{"symbol": "EURUSD", "trade_mode_name": "full", "trade_order_mode": 127, "trade_filling_mode": 2,
                                 "update_time": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(), "bid": 1.0999, "ask": 1.1,
                                 "tick_size": self.tick_size, "point": 0.00001, "trade_stops_level": 0,
                                 "trade_freeze_level": 0, "volume_min": 0.01, "volume_max": 100, "volume_step": 0.01}]}
        if name == "get_time_information":
            now = datetime.now(timezone.utc)
            return {"utc_time": now.isoformat(), "trade_server_last_known_time": now.replace(tzinfo=None).isoformat()}
        if name == "trade_order_calc_profit":
            return {"ok": True, "profit": self.loss, "currency": "USD"}
        if name == "trade_order_calc_margin":
            return {"ok": True, "margin": self.calculated_margin, "currency": "USD"}
        if name == "trade_check_market_order":
            return self.check_result
        raise AssertionError(name)


class DemoBotTests(unittest.TestCase):
    def setUp(self):
        self.broker = FakeMcpBroker()
        self.signal = CandidateSignal("BUY", "EURUSD", 1.1, 1.095, 1.11, datetime.now(timezone.utc), 8, "fixture")

    def test_valid_broker_calculations_produce_risk_limited_volume(self):
        volume = asyncio.run(self.broker.size(self.signal))
        self.assertEqual(volume, D("1.00"))
        self.assertEqual([name for name, _ in self.broker.calls].count("trade_order_calc_profit"), 1)
        self.assertNotIn("trade_send_market_order", [name for name, _ in self.broker.calls])

    def test_zero_profit_blocks_before_order(self):
        self.broker.loss = 0
        with self.assertRaisesRegex(DemoBotBlocked, "zero or invalid"):
            asyncio.run(self.broker.size(self.signal))

    def test_zero_tick_and_calculated_margin_use_positive_order_check(self):
        self.broker.tick_size = 0
        self.broker.calculated_margin = 0
        self.assertEqual(asyncio.run(self.broker.size(self.signal)), D("1.00"))
        checked = [args for name, args in self.broker.calls if name == "trade_check_market_order"]
        self.assertEqual(len(checked), 1)
        self.assertEqual(checked[0]["volume"], 0.01)
        self.assertEqual(checked[0]["sl"], self.signal.stop)
        self.assertNotIn("trade_send_market_order", [name for name, _ in self.broker.calls])

    def test_zero_margin_without_positive_order_check_blocks(self):
        self.broker.calculated_margin = 0
        self.broker.check_result = {"ok": True, "result": {"retcode": 0, "margin": 0, "margin_free": 9999}}
        with self.assertRaisesRegex(DemoBotBlocked, "margin"):
            asyncio.run(self.broker.size(self.signal))

    def test_permission_and_order_check_block(self):
        self.broker.permission = False
        with self.assertRaisesRegex(DemoBotBlocked, "DEMO"):
            asyncio.run(self.broker.size(self.signal))
        self.broker.permission = True
        self.broker.check_result = {"ok": True, "result": {"retcode": 10030, "margin": 0.52, "margin_free": 9999}}
        self.assertFalse(asyncio.run(self.broker.check_market_order({"symbol": "EURUSD", "type": "buy", "volume": .01, "sl": 1.095, "comment": "TRC-test"})))
        self.assertNotIn("trade_send_market_order", [name for name, _ in self.broker.calls])

    def test_order_check_accepts_nested_mt5_result_only_with_positive_margin(self):
        payload = {"symbol": "EURUSD", "type": "buy", "volume": .01, "sl": 1.095, "comment": "TRC-test"}
        self.assertTrue(asyncio.run(self.broker.check_market_order(payload)))
        self.broker.check_result = {"ok": True, "result": {"retcode": 0, "margin": 0, "margin_free": 9999}}
        self.assertFalse(asyncio.run(self.broker.check_market_order(payload)))

    def test_reconciliation_matches_real_mcp_order_and_deal_ids(self):
        command = DemoCommand("command-1", "key-1", "FxPro|FxPro-Demo|123",
                              datetime.now(timezone.utc) + timedelta(minutes=1), "ai-1", "EURUSD",
                              "BUY", D("0.01"), D("1.095"), D("1.11"))
        self.broker.history = {
            "orders": [{"order_id": 101, "comment": command.comment, "state": "filled"},
                       {"order_id": 102, "comment": "other trade", "state": "filled"}],
            "deals": [{"order_id": 101, "volume": 0.01}, {"order_id": 102, "volume": 0.02}],
        }
        evidence = asyncio.run(self.broker.reconcile(command))
        self.assertIsNotNone(evidence)
        self.assertEqual(evidence.filled_volume, D("0.01"))
        self.assertFalse(evidence.stop_protected)

    def test_only_closed_fresh_bars_are_used(self):
        now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        history = [{"time": (now - timedelta(minutes=15 * (i + 1))).isoformat(), "open": 1.1, "high": 1.101, "low": 1.099, "close": 1.1} for i in range(100)]
        history.reverse()
        history.append({"time": now.isoformat(), "open": 1.1, "high": 1.101, "low": 1.099, "close": 1.1})
        bars = _bars({"ok": True, "history": history}, 15, now)
        self.assertEqual(len(bars), 100)
        self.assertEqual(bars[-1].timestamp, now - timedelta(minutes=15))

    def test_server_local_quote_time_is_converted_to_utc(self):
        result = _quote_utc("2026-11-19T00:40:00", {"utc_time": "2026-11-18T22:40:01Z", "trade_server_last_known_time": "2026-11-19T00:40:01"})
        self.assertEqual(result, datetime(2026, 11, 18, 22, 40, tzinfo=timezone.utc))

    def test_one_full_demo_cycle_sends_once_only_when_armed(self):
        signal = self.signal

        class Broker:
            def __init__(self):
                self.sent = []
                self.signal = None
                self.approved_decision_id = None

            async def __aenter__(self):
                return self

            async def __aexit__(self, *_):
                return None

            async def snapshot(self):
                return {"observedAt": datetime.now(timezone.utc).isoformat(), "account": {"broker": "FxPro", "server": "FxPro-Demo", "login": "123", "environment": "DEMO"}, "positions": []}

            async def chart_bars(self, _period, now):
                return [Candle(now - timedelta(minutes=15 * (120 - index)), 1.1, 1.101, 1.099, 1.1) for index in range(120)]

            async def size(self, _signal):
                return D("0.01")

            async def preflight(self, command):
                self_test.assertEqual(command.decision_id, self.approved_decision_id)
                account = AccountRisk("DEMO", "USD", D("10000"), D("10000"), D("10000"), D(0), D(0), 0, 0, D(1))
                contract = ContractSpec("EURUSD", "USD", D("0.0001"), D("10"), D("0.01"), D("100"), D("0.01"), D(0), D(0), D("1000"))
                candidate = Candidate("EURUSD", "BUY", D("1.1"), D("1.095"), D("0.01"), D("0.0001"), D("0.00005"), D("10000"), True, True, True, True, True)
                return "FxPro|FxPro-Demo|123", account, contract, candidate

            async def check_market_order(self, _payload):
                return True

            async def send_market_order(self, payload):
                self.sent.append(payload)
                return {"ok": True}

            async def reconcile(self, command):
                return ReconciliationEvidence(command.account_binding, 1, command.requested_volume, False, True)

        class Cloud:
            def upload_snapshot(self, _token, _snapshot):
                return {"environment": "DEMO", "accountId": "account-1"}

            def request_demo_opinion(self, _token, _request):
                return {"approved": True, "decision": "BUY", "symbol": "EURUSD", "expiresAt": (datetime.now(timezone.utc) + timedelta(minutes=1)).isoformat(), "decisionId": "ai-1"}

        self_test = self
        broker = Broker()
        with tempfile.TemporaryDirectory() as directory:
            journal = Journal(Path(directory) / "test.sqlite")
            try:
                with patch("traderelaycity_connector.demo_bot.McpDemoBroker", return_value=broker), patch("traderelaycity_connector.demo_bot.evaluate_closed_bars", return_value=Evaluation(signal, "approved")):
                    args = (Cloud(), "T" * 43, "http://127.0.0.1:22346/mcp", "key", journal)
                    self.assertEqual(asyncio.run(run_demo_cycle(*args, False)).status, "ready")
                    self.assertEqual(broker.sent, [])
                    self.assertEqual(asyncio.run(run_demo_cycle(*args, True)).status, "filled")
                    self.assertEqual(len(broker.sent), 1)
                    self.assertEqual(asyncio.run(run_demo_cycle(*args, True)).status, "hold")
                    self.assertEqual(len(broker.sent), 1)
            finally:
                journal.close()


if __name__ == "__main__":
    unittest.main()
