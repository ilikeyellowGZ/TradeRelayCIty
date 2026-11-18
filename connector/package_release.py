"""Publish the single-file Windows connector as the website download."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path


CONNECTOR_DIR = Path(__file__).resolve().parent
PROJECT_DIR = CONNECTOR_DIR.parent
SOURCE = CONNECTOR_DIR / "release-dist" / "TradeRelayCity-Connector.exe"
DESTINATION = PROJECT_DIR / "public" / "downloads" / "TradeRelayCity-Connector-Windows.exe"
OLD_ARCHIVE = DESTINATION.with_suffix(".zip")
MAX_STATIC_ASSET_BYTES = 25 * 1024 * 1024


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Build the release executable first: missing or invalid {SOURCE}")
    with SOURCE.open("rb") as source:
        if source.read(2) != b"MZ":
            raise SystemExit(f"Build the release executable first: missing or invalid {SOURCE}")
    if SOURCE.stat().st_size > MAX_STATIC_ASSET_BYTES:
        raise SystemExit("Connector executable exceeds Cloudflare's 25 MiB static asset limit.")

    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    temporary = DESTINATION.with_suffix(".exe.tmp")
    try:
        with SOURCE.open("rb") as source, temporary.open("wb") as target:
            while chunk := source.read(1024 * 1024):
                target.write(chunk)
        if hashlib.sha256(temporary.read_bytes()).digest() != hashlib.sha256(SOURCE.read_bytes()).digest():
            raise SystemExit("Connector executable copy failed its integrity check.")
        os.replace(temporary, DESTINATION)
    finally:
        temporary.unlink(missing_ok=True)

    OLD_ARCHIVE.unlink(missing_ok=True)
    digest = hashlib.sha256(DESTINATION.read_bytes()).hexdigest()
    print(f"Published {DESTINATION} ({DESTINATION.stat().st_size} bytes, SHA-256 {digest})")


if __name__ == "__main__":
    main()
