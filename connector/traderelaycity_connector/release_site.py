"""Website origin embedded in each Windows connector release."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from .cloud_client import validate_website_url

DEFAULT_WEBSITE_URL = "https://traderelaycity.service-heyywebb.workers.dev"


def release_website_url(bundle_root: Path | None = None) -> str:
    root = bundle_root or Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))
    config = root / "assets" / "release-site.json"
    if not config.is_file():
        return DEFAULT_WEBSITE_URL
    try:
        value = json.loads(config.read_text(encoding="utf-8-sig"))
        return validate_website_url(value["website_url"])
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise ValueError("Bundled TradeRelayCity website origin is invalid") from error
