"""Outbound HTTPS client for owner-paired read-only snapshots."""
from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


class CloudClientError(RuntimeError):
    pass


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise CloudClientError("Connector API redirects are not accepted")


def validate_website_url(url: str) -> str:
    parsed = urlsplit(url)
    local_http = parsed.scheme == "http" and parsed.hostname in ("127.0.0.1", "localhost", "::1")
    if (parsed.scheme != "https" and not local_http) or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
        raise ValueError("TradeRelayCity website must be an HTTPS origin (loopback HTTP allowed for local testing) without a path or credentials")
    return url.rstrip("/")


class CloudClient:
    def __init__(self, website_url: str, timeout: float = 10):
        self.website_url = validate_website_url(website_url)
        self.timeout = min(max(float(timeout), 1), 30)
        self._opener = build_opener(_NoRedirect)

    def _post(self, path: str, body: dict, token: str | None = None) -> dict:
        data = json.dumps(body, separators=(",", ":")).encode("utf-8")
        if len(data) > 32_768:
            raise CloudClientError("Connector request exceeds size limit")
        headers = {"content-type": "application/json", "accept": "application/json", "user-agent": "TradeRelayCity-Connector/0.1"}
        if token:
            headers["authorization"] = f"Bearer {token}"
        request = Request(self.website_url + path, data=data, headers=headers, method="POST")
        try:
            with self._opener.open(request, timeout=self.timeout) as response:
                raw = response.read(16_385)
        except HTTPError as error:
            raise CloudClientError(f"Connector API rejected request (HTTP {error.code})") from None
        except (URLError, TimeoutError) as error:
            raise CloudClientError("Connector API is unreachable; retry later") from error
        if len(raw) > 16_384:
            raise CloudClientError("Connector API response exceeds size limit")
        try:
            result = json.loads(raw)
        except json.JSONDecodeError as error:
            raise CloudClientError("Connector API returned invalid JSON") from error
        if not isinstance(result, dict):
            raise CloudClientError("Connector API returned an invalid response")
        return result

    def pair(self, code: str, name: str) -> str:
        result = self._post("/api/connector/pair", {"code": code, "name": name})
        token, device_id = result.get("token"), result.get("deviceId")
        if not isinstance(token, str) or len(token) != 43 or not isinstance(device_id, str) or not device_id:
            raise CloudClientError("Pairing response did not include a device credential")
        return token

    def upload_snapshot(self, token: str, snapshot: dict) -> dict:
        if not token or len(token) != 43:
            raise CloudClientError("Paired device credential is missing")
        result = self._post("/api/connector/snapshot", snapshot, token)
        if result.get("mode") != "BROKER_READ_ONLY" or ("observedAt" in result and result["observedAt"] != snapshot.get("observedAt")):
            raise CloudClientError("Connector API did not confirm this read-only snapshot")
        return result

    def report_status(self, token: str, state: str) -> None:
        if not token or len(token) != 43 or state not in ("MCP_OFFLINE", "MCP_ERROR", "PAUSED"):
            raise CloudClientError("Invalid connector status report")
        result = self._post("/api/connector/status", {"state": state}, token)
        if result.get("state") != state:
            raise CloudClientError("Connector API did not confirm this status")
