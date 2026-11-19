import json
import tempfile
import unittest
from pathlib import Path

from traderelaycity_connector.release_site import DEFAULT_WEBSITE_URL, release_website_url


class ReleaseSiteTests(unittest.TestCase):
    def test_default_matches_reachable_host(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(release_website_url(Path(directory)), DEFAULT_WEBSITE_URL)

    def test_bundled_origin_is_used(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / "assets" / "release-site.json"
            config.parent.mkdir()
            config.write_text(json.dumps({"website_url": "https://traderelaycity.example"}), encoding="utf-8")
            self.assertEqual(release_website_url(Path(directory)), "https://traderelaycity.example")

    def test_invalid_bundled_origin_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / "assets" / "release-site.json"
            config.parent.mkdir()
            config.write_text(json.dumps({"website_url": "http://attacker.example/path"}), encoding="utf-8")
            with self.assertRaises(ValueError):
                release_website_url(Path(directory))


if __name__ == "__main__":
    unittest.main()
