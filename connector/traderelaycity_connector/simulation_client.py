"""Loopback-only client for the local HOLD simulation contract.

This client does not contain an MT5 adapter and cannot submit broker actions.
"""
from __future__ import annotations

import json
import argparse
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


def validate_simulation_base_url(base_url: str) -> str:
    parsed = urlsplit(base_url)
    if parsed.scheme != "http" or parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("simulation API must be plain HTTP on loopback")
    if parsed.path not in {"", "/"} or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("simulation API URL must not contain credentials or query data")
    return base_url.rstrip("/")


class SimulationClient:
    def __init__(self, base_url: str, persona_id: str, timeout: float = 5.0):
        if not persona_id.startswith("sim-") or len(persona_id) > 80:
            raise ValueError("invalid simulation persona")
        self.base_url = validate_simulation_base_url(base_url)
        self.persona_id = persona_id
        self.timeout = min(max(timeout, 0.1), 10.0)

    def _post(self, path: str, body: dict) -> dict:
        request = Request(
            self.base_url + path,
            data=json.dumps(body).encode("utf-8"),
            headers={"content-type": "application/json", "x-simulation-user": self.persona_id},
            method="POST",
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                payload = response.read(16_385)
        except (HTTPError, URLError) as exc:
            raise RuntimeError("local simulation API request failed") from exc
        if len(payload) > 16_384:
            raise RuntimeError("local simulation API response exceeded size limit")
        result = json.loads(payload)
        if not isinstance(result, dict) or result.get("isLive") is not False or result.get("mode") != "SIMULATED":
            raise RuntimeError("simulation API response did not confirm simulated mode")
        return result

    def acknowledge_one_hold(self, account_id: str) -> dict:
        poll = self._post("/api/simulation/connector/poll", {"accountId": account_id})
        command = poll.get("command")
        if command is None:
            return {"command": None, "mode": "SIMULATED", "isLive": False, "brokerAction": "NONE"}
        if command.get("operation") != "HOLD" or command.get("status") != "claimed":
            raise RuntimeError("simulation returned an operation outside the HOLD-only allowlist")
        return self._post(f"/api/simulation/connector/{command['id']}/ack", {})


def main() -> None:
    parser = argparse.ArgumentParser(description="Acknowledge one local simulated HOLD command; no broker is contacted")
    parser.add_argument("--api", default="http://127.0.0.1:5173")
    parser.add_argument("--persona", default="sim-owner")
    parser.add_argument("--account", required=True)
    args = parser.parse_args()
    result = SimulationClient(args.api, args.persona).acknowledge_one_hold(args.account)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
