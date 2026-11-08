"""Package a fresh PyInstaller folder as the website's Windows download."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


CONNECTOR_DIR = Path(__file__).resolve().parent
PROJECT_DIR = CONNECTOR_DIR.parent
SOURCE = CONNECTOR_DIR / "release-dist" / "TradeRelayCity-Connector"
DESTINATION = PROJECT_DIR / "public" / "downloads" / "TradeRelayCity-Connector-Windows.zip"
MAX_STATIC_ASSET_BYTES = 25 * 1024 * 1024
FORBIDDEN_NAMES = {"config.json", ".dev.vars", ".env"}


def main() -> None:
    executable = SOURCE / "TradeRelayCity-Connector.exe"
    if not executable.is_file():
        raise SystemExit(f"Build the release connector first: missing {executable}")

    files = sorted(path for path in SOURCE.rglob("*") if path.is_file())
    for path in files:
        if path.name.lower() in FORBIDDEN_NAMES or path.suffix.lower() in {".pem", ".key"}:
            raise SystemExit(f"Refusing to package a possible credential file: {path}")

    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    temporary = DESTINATION.with_suffix(".zip.tmp")
    try:
        with ZipFile(temporary, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
            for path in files:
                archive.write(path, (Path(SOURCE.name) / path.relative_to(SOURCE)).as_posix())
            archive.write(CONNECTOR_DIR / "RELEASE_README.txt", f"{SOURCE.name}/README.txt")
        if temporary.stat().st_size > MAX_STATIC_ASSET_BYTES:
            raise SystemExit("Connector ZIP exceeds Cloudflare's 25 MiB static asset limit.")
        with ZipFile(temporary) as archive:
            if archive.testzip() is not None:
                raise SystemExit("Connector ZIP failed its integrity check.")
        os.replace(temporary, DESTINATION)
    finally:
        temporary.unlink(missing_ok=True)

    digest = hashlib.sha256(DESTINATION.read_bytes()).hexdigest()
    print(f"Packaged {DESTINATION} ({DESTINATION.stat().st_size} bytes, SHA-256 {digest})")


if __name__ == "__main__":
    main()
