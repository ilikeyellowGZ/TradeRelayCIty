"""Fail-closed, read-only MT5 account snapshot collector."""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from typing import Any

from .mcp_adapter import validate_local_endpoint


class SnapshotError(RuntimeError):
    pass


def _payload(result: Any, name: str) -> dict:
    if result.is_error:
        raise SnapshotError(f"MT5 {name} returned an error")
    value = result.structured_content
    if value is None:
        if len(result.content) != 1 or not isinstance(getattr(result.content[0], "text", None), str):
            raise SnapshotError(f"MT5 {name} returned an unsupported response")
        if len(result.content[0].text) > 1_000_000:
            raise SnapshotError(f"MT5 {name} response is too large")
        try:
            value = json.loads(result.content[0].text)
        except json.JSONDecodeError as error:
            raise SnapshotError(f"MT5 {name} did not return JSON") from error
    if not isinstance(value, dict):
        raise SnapshotError(f"MT5 {name} did not return an object")
    return value


def _number(value: Any, label: str, minimum: float = -1e12) -> float:
    if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or not minimum <= value <= 1e12:
        raise SnapshotError(f"MT5 {label} is invalid")
    return float(value)


def _identity(value: Any, label: str, maximum: int) -> str:
    if not isinstance(value, str) or not value or len(value) > maximum or value != value.strip() or any(ord(c) < 32 for c in value):
        raise SnapshotError(f"MT5 {label} is unavailable; sign in to the broker account")
    return value


def normalize_mt5_snapshot(info: dict, open_trades: dict, observed_at: datetime | None = None) -> dict:
    """Normalize only fields actually returned by the terminal MCP account tools."""
    account = info.get("account")
    terminal = info.get("terminal")
    if not isinstance(account, dict) or not isinstance(terminal, dict):
        raise SnapshotError("MT5 account response is missing account or terminal")
    connection = terminal.get("connection")
    if not isinstance(connection, dict) or connection.get("state") != "connected":
        raise SnapshotError("MT5 broker connection is offline; no snapshot was uploaded")
    broker = _identity(account.get("broker"), "broker", 80)
    server = _identity(account.get("server"), "server", 100)
    login = _identity(account.get("login"), "login", 40)
    if login == "0":
        raise SnapshotError("MT5 account login is unavailable")
    currency = _identity(account.get("currency"), "currency", 3)
    if len(currency) != 3 or not currency.isalpha() or not currency.isupper():
        raise SnapshotError("MT5 account currency is invalid")
    account_type = account.get("type")
    if account_type not in ("demo", "real"):
        raise SnapshotError("MT5 account type is unknown")
    if not isinstance(open_trades.get("positions"), list) or not isinstance(open_trades.get("orders"), list):
        raise SnapshotError("MT5 open positions response is invalid")
    if len(open_trades["positions"]) > 100:
        raise SnapshotError("MT5 returned too many positions")
    positions = []
    for item in open_trades["positions"]:
        if not isinstance(item, dict):
            raise SnapshotError("MT5 position format is invalid")
        # These fields must be checked against a connected terminal with actual
        # positions before the position upload path can be called verified.
        side = item.get("type")
        if side in (0, "buy", "BUY"):
            side = "BUY"
        elif side in (1, "sell", "SELL"):
            side = "SELL"
        else:
            raise SnapshotError("MT5 position side is unsupported")
        ticket = str(item.get("ticket", ""))
        positions.append({
            "ticket": _identity(ticket, "position ticket", 40),
            "symbol": _identity(item.get("symbol"), "position symbol", 32),
            "side": side,
            "volume": _number(item.get("volume"), "position volume", 0.000000001),
            "priceOpen": _number(item.get("price_open"), "position open price", 0.000000001),
            "priceCurrent": _number(item.get("price_current"), "position current price", 0.000000001),
            "profit": _number(item.get("profit"), "position profit"),
            "stop": _number(item["sl"], "position stop", 0.000000001) if item.get("sl") else None,
            "target": _number(item["tp"], "position target", 0.000000001) if item.get("tp") else None,
        })
    timestamp = observed_at or datetime.now(timezone.utc)
    if timestamp.tzinfo is None:
        raise SnapshotError("Observation time must include a timezone")
    return {
        "observedAt": timestamp.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "account": {
            "broker": broker, "server": server, "login": login,
            "environment": "DEMO" if account_type == "demo" else "LIVE",
            "currency": currency,
            "balance": _number(account.get("balance"), "balance", 0),
            "equity": _number(account.get("equity"), "equity", 0),
            "marginUsed": _number(account.get("margin"), "used margin", 0),
            "marginFree": _number(account.get("margin_free"), "free margin"),
            "floatingProfit": _number(account.get("profit"), "floating profit"),
        },
        "positions": positions,
    }


async def read_broker_snapshot(endpoint: str, bearer_key: str) -> dict:
    validate_local_endpoint(endpoint)
    if not bearer_key:
        raise SnapshotError("MT5 MCP key is missing")
    import httpx2
    from mcp import ClientSession
    from mcp.client.streamable_http import streamable_http_client

    try:
        async with httpx2.AsyncClient(headers={"Authorization": f"Bearer {bearer_key}"}, timeout=httpx2.Timeout(10, read=15)) as http_client:
            async with streamable_http_client(endpoint, http_client=http_client) as (read, write, *_):
                async with ClientSession(read, write) as client:
                    await client.initialize()
                    preflight = await client.call_tool("get_workspace_info", {})
                    if preflight.is_error:
                        raise SnapshotError("MT5 workspace pre-flight check failed")
                    listing = await client.list_tools()
                    schemas = {tool.name: tool.input_schema for tool in listing.tools}
                    for name in ("get_trading_account_info", "get_trading_open_positions"):
                        if name not in schemas or schemas[name].get("required"):
                            raise SnapshotError(f"MT5 read-only tool {name} is unavailable without parameters")
                    info = _payload(await client.call_tool("get_trading_account_info", {}), "account info")
                    trades = _payload(await client.call_tool("get_trading_open_positions", {}), "open positions")
                    return normalize_mt5_snapshot(info, trades)
    except BaseExceptionGroup as error:
        def find_snapshot_error(group):
            for item in group.exceptions:
                if isinstance(item, SnapshotError):
                    return item
                if isinstance(item, BaseExceptionGroup):
                    found = find_snapshot_error(item)
                    if found:
                        return found
            return None
        known = find_snapshot_error(error)
        if known:
            raise known from None
        raise SnapshotError("MT5 MCP connection failed; check the local endpoint and key") from None
