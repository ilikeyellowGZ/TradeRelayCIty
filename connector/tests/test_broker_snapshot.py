from __future__ import annotations

import json
import threading
import unittest
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

from traderelaycity_connector.broker_snapshot import SnapshotError, normalize_mt5_snapshot
from traderelaycity_connector.cloud_client import CloudClient, validate_website_url


def account(state="connected", account_type="demo"):
    return {
        "account": {
            "broker": "FxPro", "server": "FxPro-MT5 Demo", "login": "12345",
            "type": account_type, "currency": "USD", "balance": 10000.0, "equity": 9990.0,
            "margin": 125.0, "margin_free": 9865.0, "profit": -10.0,
        },
        "terminal": {"connection": {"state": state}},
    }


class BrokerSnapshotTests(unittest.TestCase):
    def test_normalizes_connected_demo_account_and_positions(self):
        trades = {"positions": [{
            "ticket": 42, "symbol": "EURUSD", "type": 0, "volume": 0.1,
            "price_open": 1.1, "price_current": 1.099, "profit": -10.0, "sl": 1.09, "tp": 1.12,
        }], "orders": []}
        result = normalize_mt5_snapshot(account(), trades, datetime(2026, 11, 18, 8, tzinfo=timezone.utc))
        self.assertEqual(result["account"]["environment"], "DEMO")
        self.assertEqual(result["positions"][0]["side"], "BUY")
        self.assertEqual(result["account"]["marginUsed"], 125.0)
        self.assertEqual(result["account"]["marginFree"], 9865.0)
        self.assertEqual(result["account"]["floatingProfit"], -10.0)
        self.assertEqual(result["observedAt"], "2026-11-18T08:00:00.000Z")

    def test_normalizes_synchronized_demo_account_and_positions(self):
        result = normalize_mt5_snapshot(account(state="synchronized"), {"positions": [], "orders": []})
        self.assertEqual(result["account"]["environment"], "DEMO")

    def test_normalizes_current_mcp_position_shape_without_inventing_stops(self):
        trades = {"positions": [{
            "position_id": 87, "action": "sell", "symbol": "USDJPY", "volume": 0.01,
            "price_open": 159.8, "price_last": 159.9, "profit": -1.2,
        }], "orders": []}
        result = normalize_mt5_snapshot(account(), trades)
        self.assertEqual(result["positions"][0], {
            "ticket": "87", "symbol": "USDJPY", "side": "SELL", "volume": 0.01,
            "priceOpen": 159.8, "priceCurrent": 159.9, "profit": -1.2,
            "stop": None, "target": None,
        })

    def test_missing_margin_field_blocks_incomplete_snapshot(self):
        info = account()
        del info["account"]["margin_free"]
        with self.assertRaisesRegex(SnapshotError, "free margin"):
            normalize_mt5_snapshot(info, {"positions": [], "orders": []})

    def test_live_account_is_read_only_and_unknown_mode_is_rejected(self):
        result = normalize_mt5_snapshot(account(account_type="real"), {"positions": [], "orders": []})
        self.assertEqual(result["account"]["environment"], "LIVE")
        with self.assertRaisesRegex(SnapshotError, "account type"):
            normalize_mt5_snapshot(account(account_type="contest"), {"positions": [], "orders": []})

    def test_disconnected_or_missing_broker_identity_blocks_upload(self):
        with self.assertRaisesRegex(SnapshotError, "offline"):
            normalize_mt5_snapshot(account(state="disconnected"), {"positions": [], "orders": []})
        info = account()
        info["account"]["broker"] = ""
        with self.assertRaisesRegex(SnapshotError, "broker"):
            normalize_mt5_snapshot(info, {"positions": [], "orders": []})

    def test_cloud_endpoint_requires_https_except_loopback(self):
        self.assertEqual(validate_website_url("https://traderelaycity.example"), "https://traderelaycity.example")
        self.assertEqual(validate_website_url("http://127.0.0.1:5173"), "http://127.0.0.1:5173")
        for unsafe in ("http://traderelaycity.example", "https://name:pass@example.com", "https://example.com/other", "https://example.com?q=1"):
            with self.subTest(unsafe=unsafe), self.assertRaises(ValueError):
                validate_website_url(unsafe)

    def test_pair_and_upload_use_device_bearer_without_browser_cookie(self):
        seen = []

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                length = int(self.headers.get("content-length", "0"))
                body = json.loads(self.rfile.read(length))
                seen.append((self.path, self.headers.get("authorization"), self.headers.get("cookie"), self.headers.get("user-agent")))
                if self.path == "/api/connector/pair":
                    self.send_response(201)
                    answer = {"deviceId": "device-1", "token": "A" * 43}
                elif self.path == "/api/connector/status":
                    self.send_response(200)
                    answer = {"state": body["state"]}
                elif self.path == "/api/connector/sign-out":
                    self.send_response(200)
                    answer = {"signedOut": True}
                else:
                    assert body["account"]["login"] == "12345"
                    self.send_response(200)
                    answer = {"accountId": "account-1", "mode": "BROKER_READ_ONLY", "observedAt": body["observedAt"]}
                self.send_header("content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(answer).encode())

            def log_message(self, *_args):
                pass

        server = HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            client = CloudClient(f"http://127.0.0.1:{server.server_port}")
            token = client.pair("A" * 20, "Windows PC")
            snapshot = {"observedAt": "2026-11-18T08:00:00.000Z", "account": {"login": "12345"}}
            result = client.upload_snapshot(token, snapshot)
            client.report_status(token, "MCP_OFFLINE")
            client.sign_out(token)
            self.assertEqual(result["accountId"], "account-1")
            self.assertEqual(seen, [
                ("/api/connector/pair", None, None, "TradeRelayCity-Connector/0.1"),
                ("/api/connector/snapshot", "Bearer " + "A" * 43, None, "TradeRelayCity-Connector/0.1"),
                ("/api/connector/status", "Bearer " + "A" * 43, None, "TradeRelayCity-Connector/0.1"),
                ("/api/connector/sign-out", "Bearer " + "A" * 43, None, "TradeRelayCity-Connector/0.1"),
            ])
            with self.assertRaisesRegex(RuntimeError, "Invalid connector status"):
                client.report_status(token, "SYNCED")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=3)


if __name__ == "__main__":
    unittest.main()
