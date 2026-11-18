from __future__ import annotations

import asyncio
import unittest

from traderelaycity_connector.connector_flow import pair_device, sync_read_only


class FakeCloud:
    def __init__(self):
        self.uploaded = None

    def pair(self, code, name):
        if code != "A" * 20 or name != "Owner PC":
            raise AssertionError("unexpected pairing request")
        return "B" * 43

    def upload_snapshot(self, token, snapshot):
        self.uploaded = (token, snapshot)
        return {"accountId": "account-1", "mode": "BROKER_READ_ONLY"}


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


if __name__ == "__main__":
    unittest.main()
