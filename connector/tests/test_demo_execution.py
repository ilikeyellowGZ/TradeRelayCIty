from __future__ import annotations

import asyncio
import tempfile
import unittest
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from decimal import Decimal as D
from pathlib import Path

from traderelaycity_connector.demo_execution import DemoCommand, DemoExecutor, ReconciliationEvidence
from traderelaycity_connector.journal import Journal
from traderelaycity_connector.risk import AccountRisk, Candidate, ContractSpec, RiskLimits


class FakeBroker:
    def __init__(self, account, contract, candidate):
        self.account, self.contract, self.candidate = account, contract, candidate
        self.identity = "FxPro|FxPro-Demo|12345"
        self.check_ok = True
        self.send_result = {"retcode": 10009}
        self.send_error = None
        self.evidence = None
        self.send_calls = []
        self.history_calls = 0

    async def preflight(self, _command):
        return self.identity, self.account, self.contract, self.candidate

    async def check_market_order(self, payload):
        return self.check_ok

    async def send_market_order(self, payload):
        self.send_calls.append(payload)
        if self.send_error:
            raise self.send_error
        return self.send_result

    async def reconcile(self, _command):
        self.history_calls += 1
        return self.evidence


class DemoExecutionTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.journal = Journal(Path(self.temporary.name) / "journal.sqlite")
        self.addCleanup(self.journal.close)
        self.account = AccountRisk("DEMO", "USD", D("10000"), D("10000"), D("10000"), D("0"), D("0"), 0, 0, D("1"))
        self.contract = ContractSpec("EURUSD", "USD", D("0.0001"), D("10"), D("0.01"), D("100"), D("0.01"), D("0.0002"), D("0.0001"), D("1000"))
        self.candidate = Candidate("EURUSD", "BUY", D("1.1000"), D("1.0950"), D("0.09"), D("0.0001"), D("0.0001"), D("5000"), True, True, True, True, True)
        self.command = DemoCommand("cmd-001", "idem-001", "FxPro|FxPro-Demo|12345", datetime.now(timezone.utc) + timedelta(minutes=1), "decision-001", "EURUSD", "BUY", D("0.09"), D("1.0950"), None)
        self.broker = FakeBroker(self.account, self.contract, self.candidate)
        self.executor = DemoExecutor(self.journal, RiskLimits(entries_enabled=True))

    def run_submit(self, command=None):
        return asyncio.run(self.executor.submit(command or self.command, self.broker))

    def test_demo_order_requires_protective_stop_and_risk_approval(self):
        self.broker.candidate = replace(self.candidate, broker_stop_protection=False)
        result = self.run_submit()
        self.assertEqual(result.status, "risk_blocked")
        self.assertEqual(self.broker.send_calls, [])

    def test_nonfinite_market_or_contract_values_block_before_order_check(self):
        self.broker.candidate = replace(self.candidate, entry=D("NaN"))
        self.assertEqual(self.run_submit().status, "risk_blocked")
        self.assertEqual(self.broker.send_calls, [])

    def test_future_dated_snapshot_blocks_entry(self):
        self.broker.account = replace(self.account, snapshot_age_seconds=D("-1"))
        self.assertEqual(self.run_submit().status, "risk_blocked")
        self.assertEqual(self.broker.send_calls, [])

    def test_target_on_wrong_side_blocks_entry(self):
        command = replace(self.command, target=D("1.0900"))
        self.assertEqual(self.run_submit(command).status, "risk_blocked")
        self.assertEqual(self.broker.send_calls, [])

    def test_live_and_disconnected_account_never_submit(self):
        self.broker.account = replace(self.account, environment="LIVE")
        self.assertEqual(self.run_submit().status, "risk_blocked")
        self.assertEqual(self.broker.send_calls, [])

    def test_valid_demo_submit_persists_intent_and_uses_stop(self):
        self.broker.evidence = ReconciliationEvidence("FxPro|FxPro-Demo|12345", 1, D("0.09"), False, True)
        result = self.run_submit()
        self.assertEqual(result.status, "filled")
        self.assertEqual(len(self.broker.send_calls), 1)
        self.assertEqual(self.broker.send_calls[0]["sl"], 1.095)
        self.assertEqual(self.broker.send_calls[0]["volume"], 0.09)
        self.assertTrue(self.broker.send_calls[0]["comment"].startswith("TRC-"))
        self.assertEqual(self.run_submit().status, "filled")
        self.assertEqual(len(self.broker.send_calls), 1)

    def test_timeout_stays_unknown_and_duplicate_never_replays(self):
        self.broker.send_error = TimeoutError("ambiguous")
        self.assertEqual(self.run_submit().status, "unknown")
        self.broker.send_error = None
        self.assertEqual(self.run_submit().status, "unknown")
        self.assertEqual(len(self.broker.send_calls), 1)

    def test_reconciliation_requires_exact_binding_and_one_order(self):
        self.broker.evidence = ReconciliationEvidence("other|server|login", 1, D("0.09"), False, True)
        self.assertEqual(self.run_submit().status, "unknown")
        self.broker.evidence = ReconciliationEvidence("FxPro|FxPro-Demo|12345", 2, D("0.09"), False, True)
        self.assertEqual(asyncio.run(self.executor.reconcile(self.command, self.broker)).status, "unknown")

    def test_partial_fill_is_recorded_without_retry(self):
        self.broker.evidence = ReconciliationEvidence("FxPro|FxPro-Demo|12345", 1, D("0.04"), False, True)
        self.assertEqual(self.run_submit().status, "partially_filled")
        self.assertEqual(len(self.broker.send_calls), 1)

    def test_fill_without_verified_broker_stop_stays_unknown(self):
        self.broker.evidence = ReconciliationEvidence("FxPro|FxPro-Demo|12345", 1, D("0.09"), False, False)
        outcome = self.run_submit()
        self.assertEqual(outcome.status, "unknown")
        self.assertIn("protective stop", outcome.reason)
        self.assertEqual(self.journal.unresolved()[0]["status"], "unknown")

    def test_concurrent_claims_submit_the_same_command_only_once(self):
        class GatedBroker(FakeBroker):
            def __init__(self, account, contract, candidate):
                super().__init__(account, contract, candidate)
                self.preflight_calls = 0
                self.preflight_started = asyncio.Event()
                self.release = asyncio.Event()

            async def preflight(self, command):
                self.preflight_calls += 1
                self.preflight_started.set()
                await self.release.wait()
                return await super().preflight(command)

        broker = GatedBroker(self.account, self.contract, self.candidate)
        broker.evidence = ReconciliationEvidence("FxPro|FxPro-Demo|12345", 1, D("0.10"), False, True)

        async def submit_both():
            first = asyncio.create_task(self.executor.submit(self.command, broker))
            await broker.preflight_started.wait()
            second = asyncio.create_task(self.executor.submit(self.command, broker))
            await asyncio.sleep(0)
            broker.release.set()
            return await asyncio.gather(first, second)

        asyncio.run(submit_both())
        self.assertEqual(broker.preflight_calls, 1)
        self.assertEqual(len(broker.send_calls), 1)

    def test_concurrent_distinct_commands_wait_for_prior_reconciliation(self):
        class GatedBroker(FakeBroker):
            def __init__(self, account, contract, candidate):
                super().__init__(account, contract, candidate)
                self.preflight_started = asyncio.Event()
                self.release = asyncio.Event()
                self.preflight_calls = 0

            async def preflight(self, command):
                self.preflight_calls += 1
                self.preflight_started.set()
                await self.release.wait()
                return await super().preflight(command)

        broker = GatedBroker(self.account, self.contract, self.candidate)
        other = replace(self.command, command_id="cmd-002", idempotency_key="idem-002")

        async def submit_both():
            first = asyncio.create_task(self.executor.submit(self.command, broker))
            await broker.preflight_started.wait()
            second = asyncio.create_task(self.executor.submit(other, broker))
            await asyncio.sleep(0)
            broker.release.set()
            return await asyncio.gather(first, second)

        outcomes = asyncio.run(submit_both())
        self.assertEqual(broker.preflight_calls, 1)
        self.assertEqual(len(broker.send_calls), 1)
        self.assertEqual({outcome.status for outcome in outcomes}, {"unknown", "risk_blocked"})

    def test_simultaneous_commands_do_not_use_the_same_preflight_after_a_fast_fill(self):
        class GatedBroker(FakeBroker):
            def __init__(self, account, contract, candidate):
                super().__init__(account, contract, candidate)
                self.preflight_started = asyncio.Event()
                self.release = asyncio.Event()
                self.preflight_calls = 0

            async def preflight(self, command):
                self.preflight_calls += 1
                self.preflight_started.set()
                await self.release.wait()
                return await super().preflight(command)

        broker = GatedBroker(self.account, self.contract, self.candidate)
        broker.evidence = ReconciliationEvidence("FxPro|FxPro-Demo|12345", 1, self.command.requested_volume, False, True)
        other = replace(self.command, command_id="cmd-002", idempotency_key="idem-002")

        async def submit_both():
            first = asyncio.create_task(self.executor.submit(self.command, broker))
            await broker.preflight_started.wait()
            second = asyncio.create_task(self.executor.submit(other, broker))
            await asyncio.sleep(0)
            broker.release.set()
            return await asyncio.gather(first, second)

        outcomes = asyncio.run(submit_both())
        self.assertEqual(broker.preflight_calls, 1)
        self.assertEqual(len(broker.send_calls), 1)
        self.assertEqual({outcome.status for outcome in outcomes}, {"filled", "risk_blocked"})

    def test_oversized_command_is_blocked_instead_of_silently_resized(self):
        self.broker.candidate = replace(self.candidate, requested_volume=D("0.10"))
        command = replace(self.command, requested_volume=D("0.10"))
        self.assertEqual(self.run_submit(command).status, "risk_blocked")
        self.assertEqual(self.broker.send_calls, [])

    def test_journal_rejects_idempotency_collision_with_different_intent(self):
        self.journal.persist_intent("cmd-001", "idem-001", self.command.account_binding, "OPEN_DEMO", '{"side":"BUY"}')
        with self.assertRaises(ValueError):
            self.journal.persist_intent("cmd-001", "idem-001", self.command.account_binding, "OPEN_DEMO", '{"side":"SELL"}')


if __name__ == "__main__":
    unittest.main()
