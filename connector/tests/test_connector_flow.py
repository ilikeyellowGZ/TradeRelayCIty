from __future__ import annotations

import asyncio
import unittest

from traderelaycity_connector.connector_flow import pair_device, sync_read_only
from traderelaycity_connector.broker_snapshot import SnapshotError


class FakeCloud:
    def __init__(self):
        self.uploaded = None
        self.statuses = []

    def pair(self, code, name):
        if code != "A" * 20 or name != "Owner PC":
            raise AssertionError("unexpected pairing request")
        return "B" * 43

    def upload_snapshot(self, token, snapshot):
        self.uploaded = (token, snapshot)
        return {"accountId": "account-1", "mode": "BROKER_READ_ONLY"}

    def report_status(self, token, state):
        self.statuses.append((token, state))


class ConnectorFlowTests(unittest.TestCase):
    def test_pairing_saves_device_token_only_in_secure_store(self):
        saved = []
        result = pair_device(FakeCloud(), "A" * 20, "Owner PC", lambda key, value: saved.append((key, value)))
        self.assertIsNone(result)
        self.assertEqual(saved, [("TradeRelayCity/device", "B" * 43)])

    def test_sync_uploads_exact_read_only_snapshot(self):
        cloud = FakeCloud()
        snapshot = {"account": {"login": "12345"}, "positions": []}

        async def read(endpoint, key):
            self.assertEqual((endpoint, key), ("http://127.0.0.1:22346/mcp", "mt5-test-key"))
            return snapshot

        result = asyncio.run(sync_read_only(cloud, read, "http://127.0.0.1:22346/mcp", "mt5-test-key", "B" * 43))
        self.assertEqual(result["accountId"], "account-1")
        self.assertEqual(cloud.uploaded, ("B" * 43, snapshot))

    def test_failed_mt5_read_reports_fixed_state_and_never_uploads(self):
        cloud = FakeCloud()

        async def disconnected(_endpoint, _key):
            raise SnapshotError("MT5 broker connection is offline; no snapshot was uploaded")

        with self.assertRaises(SnapshotError):
            asyncio.run(sync_read_only(cloud, disconnected, "http://127.0.0.1:22346/mcp", "mt5-test-key", "B" * 43))
        self.assertIsNone(cloud.uploaded)
        self.assertEqual(cloud.statuses, [("B" * 43, "MCP_OFFLINE")])

        async def malformed(_endpoint, _key):
            raise SnapshotError("MT5 account response is invalid")

        with self.assertRaises(SnapshotError):
            asyncio.run(sync_read_only(cloud, malformed, "http://127.0.0.1:22346/mcp", "mt5-test-key", "B" * 43))
        self.assertEqual(cloud.statuses[-1], ("B" * 43, "MCP_ERROR"))


if __name__ == "__main__":
    unittest.main()
