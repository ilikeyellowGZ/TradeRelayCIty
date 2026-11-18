"""Fail-closed demo entry state machine. No production path invokes this module yet."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Protocol

from .journal import Journal
from .risk import AccountRisk, Candidate, ContractSpec, RiskLimits, evaluate_candidate


@dataclass(frozen=True)
class DemoCommand:
    command_id: str
    idempotency_key: str
    account_binding: str
    expires_at: datetime
    decision_id: str
    symbol: str
    side: str
    requested_volume: Decimal
    stop: Decimal
    target: Decimal | None

    @property
    def comment(self) -> str:
        return "TRC-" + hashlib.sha256(self.command_id.encode("utf-8")).hexdigest()[:26]


@dataclass(frozen=True)
class ReconciliationEvidence:
    account_binding: str
    matching_order_count: int
    filled_volume: Decimal
    rejected: bool


@dataclass(frozen=True)
class ExecutionOutcome:
    status: str
    reason: str = ""


class DemoBroker(Protocol):
    async def preflight(self, command: DemoCommand) -> tuple[str, AccountRisk, ContractSpec, Candidate]: ...
    async def check_market_order(self, payload: dict) -> bool: ...
    async def send_market_order(self, payload: dict) -> dict: ...
    async def reconcile(self, comment: str, account_binding: str) -> ReconciliationEvidence | None: ...


class DemoExecutor:
    def __init__(self, journal: Journal, limits: RiskLimits):
        self.journal = journal
        self.limits = limits

    def _intent(self, command: DemoCommand) -> str:
        return json.dumps({
            "decisionId": command.decision_id, "symbol": command.symbol, "side": command.side,
            "volume": str(command.requested_volume), "stop": str(command.stop),
            "target": str(command.target) if command.target is not None else None,
            "expiresAt": command.expires_at.isoformat(), "comment": command.comment,
        }, separators=(",", ":"), sort_keys=True)

    def _existing(self, command: DemoCommand, intent: str) -> ExecutionOutcome | None:
        row = self.journal.connection.execute(
            "SELECT * FROM commands WHERE command_id=? OR idempotency_key=?", (command.command_id, command.idempotency_key)
        ).fetchone()
        if row is None:
            return None
        if row["command_id"] != command.command_id or row["idempotency_key"] != command.idempotency_key or row["account_binding"] != command.account_binding or row["intent_json"] != intent:
            raise ValueError("Command ID or idempotency key was reused with different intent")
        return ExecutionOutcome("unknown" if row["status"] in ("intent_persisted", "submitting") else row["status"])

    def _block(self, command: DemoCommand, reason: str) -> ExecutionOutcome:
        self.journal.set_status(command.command_id, "risk_blocked", json.dumps({"reason": reason}))
        return ExecutionOutcome("risk_blocked", reason)

    async def submit(self, command: DemoCommand, broker: DemoBroker) -> ExecutionOutcome:
        if not command.command_id or not command.idempotency_key or not command.decision_id or not command.account_binding:
            return ExecutionOutcome("risk_blocked", "Missing command identity or decision evidence")
        if command.expires_at.tzinfo is None or command.expires_at <= datetime.now(timezone.utc):
            return ExecutionOutcome("risk_blocked", "Command expired or has no UTC expiry")
        if not command.requested_volume.is_finite() or not command.stop.is_finite() or (command.target is not None and not command.target.is_finite()):
            return ExecutionOutcome("risk_blocked", "Order values must be finite")
        intent = self._intent(command)
        existing = self._existing(command, intent)
        if existing is not None:
            return existing
        if self.journal.unresolved():
            return ExecutionOutcome("risk_blocked", "A prior submission requires reconciliation")
        reserved = self.journal.persist_intent(command.command_id, command.idempotency_key, command.account_binding, "OPEN_DEMO", intent)
        if not reserved:
            return self._existing(command, intent) or ExecutionOutcome("risk_blocked", "A prior submission requires reconciliation")
        try:
            identity, account, contract, candidate = await broker.preflight(command)
        except Exception:
            return self._block(command, "Broker preflight unavailable")
        if identity != command.account_binding or account.environment != "DEMO":
            return self._block(command, "Exact connected demo account binding required")
        if candidate.symbol != command.symbol or candidate.side != command.side or candidate.requested_volume != command.requested_volume or candidate.stop != command.stop:
            return self._block(command, "Broker preflight differs from approved decision")
        decision = evaluate_candidate(candidate, account, contract, self.limits)
        if not decision.allowed or decision.volume is None:
            return self._block(command, "; ".join(decision.reasons))
        if decision.volume != command.requested_volume:
            return self._block(command, "Approved order volume exceeds current risk budget")
        if command.target is not None and ((command.side == "BUY" and command.target <= candidate.entry) or (command.side == "SELL" and command.target >= candidate.entry)):
            return self._block(command, "Target is on the wrong side of the entry")
        payload = {"symbol": command.symbol, "type": command.side.lower(), "volume": float(decision.volume), "sl": float(command.stop), "comment": command.comment}
        if command.target is not None:
            payload["tp"] = float(command.target)
        try:
            if not await broker.check_market_order(payload):
                return self._block(command, "Broker order check rejected this entry")
        except Exception:
            return self._block(command, "Broker order check unavailable")
        self.journal.set_status(command.command_id, "submitting")
        try:
            await broker.send_market_order(payload)
        except Exception:
            self.journal.set_status(command.command_id, "unknown")
            return ExecutionOutcome("unknown", "Submission outcome requires broker reconciliation")
        self.journal.set_status(command.command_id, "unknown")
        return await self.reconcile(command, broker)

    async def reconcile(self, command: DemoCommand, broker: DemoBroker) -> ExecutionOutcome:
        intent = self._intent(command)
        existing = self._existing(command, intent)
        if existing is None:
            return ExecutionOutcome("unknown", "No persisted intent")
        if existing.status in ("filled", "partially_filled", "rejected"):
            return existing
        try:
            evidence = await broker.reconcile(command.comment, command.account_binding)
        except Exception:
            return ExecutionOutcome("unknown", "Broker history unavailable")
        if evidence is None or evidence.account_binding != command.account_binding or evidence.matching_order_count != 1 or not evidence.filled_volume.is_finite():
            return ExecutionOutcome("unknown", "Broker evidence is absent or ambiguous")
        if evidence.filled_volume < 0 or evidence.filled_volume > command.requested_volume:
            return ExecutionOutcome("unknown", "Broker filled volume is inconsistent")
        if evidence.filled_volume == command.requested_volume:
            status = "filled"
        elif evidence.filled_volume > 0:
            status = "partially_filled"
        elif evidence.rejected:
            status = "rejected"
        else:
            return ExecutionOutcome("unknown", "No confirmed fill or rejection")
        self.journal.set_status(command.command_id, status, json.dumps({"filledVolume": str(evidence.filled_volume)}))
        return ExecutionOutcome(status)
