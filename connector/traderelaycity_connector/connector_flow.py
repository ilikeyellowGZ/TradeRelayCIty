from __future__ import annotations

DEVICE_CREDENTIAL = "TradeRelayCity/device"


def pair_device(cloud, code: str, name: str, store) -> None:
    token = cloud.pair(code, name)
    store(DEVICE_CREDENTIAL, token)
    return None


async def sync_read_only(cloud, read, endpoint: str, key: str, token: str) -> dict:
    snapshot = await read(endpoint, key)
    return cloud.upload_snapshot(token, snapshot)
