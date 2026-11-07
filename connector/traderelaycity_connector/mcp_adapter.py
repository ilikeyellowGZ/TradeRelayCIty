"""Read-only MCP diagnostics using the official Python SDK transport APIs."""
from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse

READ_ONLY_TOOLS = frozenset({
    "get_trading_account_info", "get_trading_open_positions", "get_trading_history_orders",
    "get_trading_history_positions", "get_marketwatch_symbols", "marketdata_symbol_search",
    "marketdata_symbol_get", "marketdata_symbol_history", "get_chart_history", "get_chart_ticks_history",
    "get_time_information",
})
FORBIDDEN_TOOLS = frozenset({"trade_send_market_order", "trade_send_pending_order", "trade_modify_sl_tp", "trade_close_single_position", "trade_close_by_position", "trade_delete_order", "shell", "write", "edit", "send_web_request"})

@dataclass(frozen=True)
class McpDiagnostics:
    endpoint: str
    discovered_tools: tuple[str, ...]
    allowed_read_only_tools: tuple[str, ...]
    blocked_tools: tuple[str, ...]
    account_summary: str
    ready_for_demo: bool = False
    live_entries_enabled: bool = False

def validate_local_endpoint(endpoint: str) -> None:
    parsed = urlparse(endpoint)
    if parsed.scheme != "http" or parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("MT5 MCP endpoint must use HTTP on this PC's loopback interface.")
    if parsed.path.rstrip("/") != "/mcp":
        raise ValueError("Use the terminal's exact MCP endpoint path, typically /mcp.")

async def inspect_mt5(endpoint: str, bearer_key: str) -> McpDiagnostics:
    validate_local_endpoint(endpoint)
    import httpx2
    from mcp import Client
    from mcp.client.streamable_http import streamable_http_client

    timeout = httpx2.Timeout(30.0, read=60.0)
    async with httpx2.AsyncClient(headers={"Authorization": f"Bearer {bearer_key}"}, timeout=timeout) as http_client:
        transport = streamable_http_client(endpoint, http_client=http_client)
        async with Client(transport) as client:
            listing = await client.list_tools()
            discovered = tuple(sorted(tool.name for tool in listing.tools))
            allowed = tuple(name for name in discovered if name in READ_ONLY_TOOLS)
            blocked = tuple(name for name in discovered if name in FORBIDDEN_TOOLS)
            summary = "MCP connected; read-only capabilities enumerated. Account binding remains unconfirmed."
            if "get_trading_account_info" in allowed:
                schema = next(tool.inputSchema for tool in listing.tools if tool.name == "get_trading_account_info")
                if not schema.get("required"):
                    result = await client.call_tool("get_trading_account_info", {})
                    summary = "Account info read succeeded. Review the returned broker, login, server, currency, and demo/live flag before binding."
                    if result.isError:
                        summary = "MCP tool discovery succeeded, but the read-only account info call returned an error."
                else:
                    summary = "Account info capability is present but requires unsupported parameters; no order tools were called."
            return McpDiagnostics(endpoint, discovered, allowed, blocked, summary)
