import tempfile
import unittest
import asyncio
import sys
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from traderelaycity_connector.journal import Journal
from traderelaycity_connector.mcp_adapter import FORBIDDEN_TOOLS, READ_ONLY_TOOLS, inspect_mt5, validate_local_endpoint
from traderelaycity_connector.secure_store import delete_secret, read_secret, store_secret
from traderelaycity_connector.risk import AccountRisk, Candidate, ContractSpec, RiskLimits, evaluate_candidate
from traderelaycity_connector.strategy import Candle, confirmed_swings, validate_bars
from traderelaycity_connector.backtest import _simulate
from traderelaycity_connector.strategy import CandidateSignal
from traderelaycity_connector.simulation_client import SimulationClient, validate_simulation_base_url
from decimal import Decimal as D
from datetime import datetime, timedelta, timezone

class ConnectorBoundaryTests(unittest.TestCase):
    @unittest.skipUnless(sys.platform == "win32", "Windows Credential Manager only")
    def test_credential_manager_round_trip(self):
        target = f"TradeRelayCity-test/{uuid.uuid4()}"
        store_secret(target, "test-only-secret")
        try:
            self.assertEqual(read_secret(target), "test-only-secret")
        finally:
            delete_secret(target)

    def test_rejected_mcp_key_has_actionable_error(self):
        class RejectingHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(401)
                self.end_headers()

            def do_POST(self):
                self.send_response(401)
                self.end_headers()

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), RejectingHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with self.assertRaisesRegex(ValueError, "MT5 rejected the MCP key"):
                asyncio.run(inspect_mt5(f"http://127.0.0.1:{server.server_port}/mcp", "test-only-token"))
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

    def test_simulation_client_is_loopback_only_and_persona_scoped(self):
        self.assertEqual(validate_simulation_base_url("http://127.0.0.1:5173/"), "http://127.0.0.1:5173")
        for url in ("https://127.0.0.1:5173", "http://example.com", "http://127.0.0.1:5173/prefix"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                validate_simulation_base_url(url)
        with self.assertRaises(ValueError):
            SimulationClient("http://127.0.0.1:5173", "owner")

    def test_only_loopback_mcp_endpoint_is_accepted(self):
        validate_local_endpoint("http://127.0.0.1:22346/mcp")
        for endpoint in ("https://127.0.0.1/mcp", "http://example.com/mcp", "http://127.0.0.1/admin"):
            with self.subTest(endpoint=endpoint), self.assertRaises(ValueError):
                validate_local_endpoint(endpoint)

    def test_execution_and_shell_tools_are_not_in_read_allowlist(self):
        self.assertTrue(FORBIDDEN_TOOLS.isdisjoint(READ_ONLY_TOOLS))
        self.assertIn("trade_send_market_order", FORBIDDEN_TOOLS)
        self.assertIn("shell", FORBIDDEN_TOOLS)

    def test_local_intent_is_idempotent_and_recoverable(self):
        with tempfile.TemporaryDirectory() as directory:
            journal = Journal(Path(directory) / "connector.sqlite")
            journal.persist_intent("cmd-1", "key-1", "demo:123", "OPEN", '{"side":"BUY"}')
            journal.persist_intent("cmd-1", "key-1", "demo:123", "OPEN", '{"side":"BUY"}')
            self.assertEqual(len(journal.unresolved()), 1)
            journal.set_status("cmd-1", "unknown")
            self.assertEqual(journal.unresolved()[0]["status"], "unknown")
            journal.close()

class RiskEngineTests(unittest.TestCase):
    def setUp(self):
        self.account = AccountRisk("DEMO", "USD", D("10000"), D("10000"), D("11000"), D("100"), D("0"), 1, 1, D("1"))
        self.contract = ContractSpec("EURUSD", "USD", D("0.0001"), D("10"), D("0.01"), D("100"), D("0.01"), D("0.0002"), D("0.0001"), D("1000"))
        self.candidate = Candidate("EURUSD", "BUY", D("1.1000"), D("1.0950"), D("1.00"), D("0.0001"), D("0.0001"), D("5000"), True, True, True, True, True)
        self.limits = RiskLimits(entries_enabled=True)

    def test_sizes_down_to_volume_step_under_trade_and_total_risk_caps(self):
        result = evaluate_candidate(self.candidate, self.account, self.contract, self.limits)
        self.assertTrue(result.allowed, result.reasons)
        self.assertEqual(result.volume, D("0.09"))
        self.assertLessEqual(result.risk_amount, D("50"))

    def test_missing_account_currency_conversion_and_stale_data_block(self):
        wrong_currency = ContractSpec("EURUSD", "EUR", D("0.0001"), D("10"), D("0.01"), D("100"), D("0.01"), D("0"), D("0"), D("1000"))
        result = evaluate_candidate(self.candidate, self.account, wrong_currency, self.limits)
        self.assertFalse(result.allowed)
        self.assertIn("contract tick value is not in the account currency", result.reasons)
        stale_account = AccountRisk("DEMO", "USD", D("10000"), D("10000"), D("11000"), D("0"), D("0"), 1, 1, D("99"))
        self.assertFalse(evaluate_candidate(self.candidate, stale_account, self.contract, self.limits).allowed)

    def test_live_disabled_and_daily_loss_caps_block_without_sizing(self):
        live_account = AccountRisk("LIVE", "USD", D("10000"), D("10000"), D("11000"), D("0"), D("0"), 0, 0, D("1"))
        live = evaluate_candidate(self.candidate, live_account, self.contract, self.limits)
        self.assertFalse(live.allowed)
        self.assertIn("live entry execution is disabled in this build", live.reasons)
        loss_account = AccountRisk("DEMO", "USD", D("9700"), D("10000"), D("11000"), D("0"), D("0"), 0, 0, D("1"))
        loss = evaluate_candidate(self.candidate, loss_account, self.contract, self.limits)
        self.assertFalse(loss.allowed)
        self.assertIn("daily equity loss limit reached", loss.reasons)

class ClosedBarStrategyTests(unittest.TestCase):
    def test_swing_only_appears_after_required_right_hand_bars_close(self):
        start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        bars = [Candle(start + timedelta(minutes=15 * i), 1, high, low, 1) for i, (high, low) in enumerate([(2, 1), (3, 1), (5, 0.9), (3, 1), (2, 1)])]
        self.assertNotIn((2, 5), confirmed_swings(bars[:4])[0])
        self.assertIn((2, 5), confirmed_swings(bars)[0])

    def test_duplicate_bar_times_are_rejected(self):
        now = datetime(2026, 1, 1, tzinfo=timezone.utc)
        bars = [Candle(now, 1, 2, .5, 1), Candle(now, 1, 2, .5, 1)]
        self.assertIn("duplicate", validate_bars(bars))

    def test_backtest_assumes_stop_first_when_one_bar_touches_both(self):
        start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        signal = CandidateSignal("BUY", "EURUSD", 1.1, 1.0, 1.3, start, 8, "fixture")
        bars = [Candle(start + timedelta(minutes=15), 1.1, 1.31, .99, 1.2)]
        trade = _simulate(signal, bars, 0, 0, 0)
        self.assertEqual(trade.status, "both_touched_stop_assumed")
        self.assertEqual(trade.result_r, -1)

if __name__ == "__main__":
    unittest.main()
