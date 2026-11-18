from __future__ import annotations

from .broker_snapshot import SnapshotError

DEVICE_CREDENTIAL = "TradeRelayCity/device"


def pair_device(cloud, code: str, name: str, store) -> None:
    token = cloud.pair(code, name)
    store(DEVICE_CREDENTIAL, token)
    return None


async def sync_read_only(cloud, read, endpoint: str, key: str, token: str) -> dict:
    try:
        snapshot = await read(endpoint, key)
    except SnapshotError as error:
        state = "MCP_OFFLINE" if ("broker connection is offline" in str(error) or "MCP connection failed" in str(error)) else "MCP_ERROR"
        try:
            cloud.report_status(token, state)
        except Exception:
            pass  # Keep the original MT5 error visible; the next sync can retry status.
        raise
    return cloud.upload_snapshot(token, snapshot)
