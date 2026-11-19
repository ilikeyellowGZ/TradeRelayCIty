"""Read-only MCP diagnostics using the official Python SDK transport APIs."""
from __future__ import annotations

from dataclasses import dataclass
import asyncio
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import ProxyHandler, Request, build_opener

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
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("MT5 MCP endpoint must not contain credentials, query data, or a fragment.")

async def inspect_mt5(endpoint: str, bearer_key: str) -> McpDiagnostics:
    validate_local_endpoint(endpoint)
    import httpx2
    from mcp import ClientSession
    from mcp.client.streamable_http import streamable_http_client

    timeout = httpx2.Timeout(10.0, read=15.0)
    async with httpx2.AsyncClient(headers={"Authorization": f"Bearer {bearer_key}"}, timeout=timeout) as http_client:
        try:
            transport = streamable_http_client(endpoint, http_client=http_client)
            async with transport as (read, write, *_):
              async with ClientSession(read, write) as client:
                await client.initialize()
                # MT5 requires this as the first tool call of each session.
                workspace = await client.call_tool("get_workspace_info", {})
                if workspace.is_error:
                    raise ValueError("MT5 workspace pre-flight check failed.")
                listing = await client.list_tools()
                discovered = tuple(sorted(tool.name for tool in listing.tools))
                allowed = tuple(name for name in discovered if name in READ_ONLY_TOOLS)
                blocked = tuple(name for name in discovered if name in FORBIDDEN_TOOLS)
                summary = "MCP connected; read-only capabilities enumerated. Account binding remains unconfirmed."
                ready_for_demo = False
                if "get_trading_account_info" in allowed:
                    schema = next(tool.input_schema for tool in listing.tools if tool.name == "get_trading_account_info")
                    if not schema.get("required"):
                        result = await client.call_tool("get_trading_account_info", {})
                        if result.is_error:
                            summary = "MCP tool discovery succeeded, but the read-only account info call returned an error."
                        else:
                            value = result.structured_content
                            if value is None and len(result.content) == 1 and isinstance(getattr(result.content[0], "text", None), str):
                                try:
                                    value = json.loads(result.content[0].text)
                                except json.JSONDecodeError:
                                    value = None
                            account = value.get("account", {}) if isinstance(value, dict) else {}
                            terminal = value.get("terminal", {}) if isinstance(value, dict) else {}
                            connection = terminal.get("connection", {}) if isinstance(terminal, dict) else {}
                            mode = account.get("type") if isinstance(account, dict) else None
                            state = connection.get("state") if isinstance(connection, dict) else None
                            ready_for_demo = mode == "demo" and state in ("connected", "synchronized")
                            summary = f"MCP account reports {str(mode or 'unknown').upper()} and broker connection {state or 'unknown'}."
                    else:
                        summary = "Account info capability is present but requires unsupported parameters; no order tools were called."
                return McpDiagnostics(endpoint, discovered, allowed, blocked, summary, ready_for_demo=ready_for_demo)
        except (Exception, BaseExceptionGroup) as error:
            # Probe with a bounded standard initialize POST; a GET can be an
            # infinite SSE stream and must never be used for this diagnostic.
            def probe_status() -> int | None:
                data = json.dumps({
                    "jsonrpc": "2.0", "id": 1, "method": "initialize",
                    "params": {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "TradeRelayCity", "version": "0.1"}},
                }).encode("utf-8")
                request = Request(endpoint, data=data, method="POST", headers={"Authorization": f"Bearer {bearer_key}", "Content-Type": "application/json", "Accept": "application/json, text/event-stream"})
                try:
                    with build_opener(ProxyHandler({})).open(request, timeout=5) as response:
                        return response.status
                except HTTPError as response:
                    status = response.code
                    response.close()
                    return status
                except (URLError, TimeoutError):
                    return None

            if await asyncio.to_thread(probe_status) == 401:
                raise ValueError(
                    "MT5 rejected the MCP key (HTTP 401). Copy the current terminal MCP API key "
                    "from MT5 > Tools > Options > MCP, save it in the connector, and retry."
                ) from error
            raise
