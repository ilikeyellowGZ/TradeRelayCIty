from __future__ import annotations

import asyncio
import json
import os
import sys
import tkinter as tk
import queue
import threading
import time
from pathlib import Path
from tkinter import messagebox, ttk

from .mcp_adapter import inspect_mt5
from .broker_snapshot import read_broker_snapshot
from .cloud_client import CloudClient
from .connector_flow import DEVICE_CREDENTIAL, pair_device, sync_read_only
from .demo_bot import run_demo_cycle
from .journal import Journal
from .instance_lock import InstanceAlreadyRunning, SingleInstanceLock
from .secure_store import CredentialStoreError, read_secret, store_secret
from .release_site import release_website_url

APP_DIR = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "TradeRelayCity"
CONFIG_FILE = APP_DIR / "config.json"
MCP_CREDENTIAL = "TradeRelayCity/mt5-mcp"


def icon_path() -> Path:
    bundle_root = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))
    return bundle_root / "assets" / "TradeRelayCity.ico"

def load_config() -> dict:
    defaults = {"website_url": release_website_url(), "mcp_url": "http://127.0.0.1:22346/mcp", "environment": "SIMULATED", "live_entry_enabled": False}
    if CONFIG_FILE.exists():
        try:
            data = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
            return {**defaults, **data} if isinstance(data, dict) else defaults
        except (OSError, json.JSONDecodeError):
            return defaults
    return defaults

class ConnectorApp(tk.Tk):
    def __init__(self):
        super().__init__()
        icon = icon_path()
        if icon.is_file():
            self.iconbitmap(default=str(icon))
        self.title("TradeRelayCity Connector")
        self.geometry("600x805")
        self.minsize(520, 805)
        self.configure(bg="#f7f5f0")
        self.config_data = load_config()
        self.status = tk.StringVar(value="Offline · no account bound")
        self.message = tk.StringVar(value="Pair this device from the signed-in website, then sync a read-only MT5 snapshot.")
        self.sync_enabled = bool(self.config_data.get("auto_sync_enabled", False))
        self.sync_busy = False
        self.sync_results: queue.Queue[tuple[bool, str]] = queue.Queue()
        self.demo_results: queue.Queue[tuple[bool, str]] = queue.Queue()
        self.demo_busy = False
        self.demo_arm = tk.BooleanVar(value=False)
        self.demo_watch = tk.BooleanVar(value=False)
        self.next_demo_at = 0.0
        self._build()
        self.after(200, self._drain_sync_results)
        self.after(15_000, self._scheduled_sync)

    def _build(self) -> None:
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("TFrame", background="#f7f5f0")
        style.configure("TLabel", background="#f7f5f0", foreground="#041e42", font=("Segoe UI", 10))
        style.configure("Title.TLabel", font=("Segoe UI", 18, "bold"))
        style.configure("Hint.TLabel", foreground="#526174", wraplength=535)
        outer = ttk.Frame(self, padding=24)
        outer.pack(fill="both", expand=True)
        ttk.Label(outer, text="TRADERELAYCITY CONNECTOR", style="Title.TLabel").pack(anchor="w")
        ttk.Label(outer, textvariable=self.status, foreground="#1553d5").pack(anchor="w", pady=(7, 18))
        fields = [
            ("TradeRelayCity website URL", "website_url", release_website_url()),
            ("MT5 MCP endpoint (local PC only)", "mcp_url", "http://127.0.0.1:22346/mcp"),
        ]
        self.entries: dict[str, ttk.Entry] = {}
        for label, key, default in fields:
            ttk.Label(outer, text=label).pack(anchor="w", pady=(7, 3))
            entry = ttk.Entry(outer)
            entry.insert(0, self.config_data.get(key, default))
            entry.pack(fill="x", ipady=5)
            self.entries[key] = entry
        ttk.Label(outer, text="MT5 MCP Bearer key (kept in Windows Credential Manager)").pack(anchor="w", pady=(12, 3))
        self.secret = ttk.Entry(outer, show="•")
        self.secret.pack(fill="x", ipady=5)
        try:
            self.secret.insert(0, read_secret(MCP_CREDENTIAL) or "")
        except CredentialStoreError:
            pass
        ttk.Label(outer, text="MT5 DEMO bot: off until armed here · Live entries disabled", foreground="#8e2535").pack(anchor="w", pady=(16, 5))
        row = ttk.Frame(outer)
        row.pack(fill="x", pady=(9, 11))
        ttk.Button(row, text="Save local settings", command=self.save).pack(side="left")
        ttk.Button(row, text="Test connection (read only)", command=self.test_connection).pack(side="right")
        ttk.Label(outer, text="One-time pairing code from the website").pack(anchor="w", pady=(8, 3))
        self.pair_code = ttk.Entry(outer)
        self.pair_code.pack(fill="x", ipady=5)
        cloud_row = ttk.Frame(outer)
        cloud_row.pack(fill="x", pady=(10, 12))
        ttk.Button(cloud_row, text="Pair this device", command=self.pair).pack(side="left")
        ttk.Button(cloud_row, text="Sync MT5 snapshot (read only)", command=self.sync_snapshot).pack(side="right")
        self.auto_sync_button = ttk.Button(outer, text="Pause automatic sync" if self.sync_enabled else "Resume automatic sync", command=self.toggle_auto_sync)
        self.auto_sync_button.pack(anchor="w", pady=(0, 10))
        ttk.Separator(outer).pack(fill="x", pady=5)
        ttk.Checkbutton(outer, text="Arm EURUSD DEMO orders for this session (one per UTC day)", variable=self.demo_arm).pack(anchor="w", pady=(5, 3))
        ttk.Checkbutton(outer, text="Run the demo bot every 15 minutes while armed", variable=self.demo_watch).pack(anchor="w", pady=(0, 5))
        ttk.Button(outer, text="Run one demo bot cycle", command=self.run_demo_bot).pack(anchor="w", pady=(0, 10))
        ttk.Separator(outer).pack(fill="x", pady=7)
        ttk.Label(outer, textvariable=self.message, style="Hint.TLabel").pack(fill="x", anchor="w")
        ttk.Label(outer, text="Demo entries need a closed-bar setup, AI approval, broker calculations, order check and protective stop. Missing data blocks the order.", style="Hint.TLabel").pack(fill="x", anchor="w", pady=(14, 0))

    def save(self) -> bool:
        APP_DIR.mkdir(parents=True, exist_ok=True)
        self.config_data = {"website_url": self.entries["website_url"].get().strip(), "mcp_url": self.entries["mcp_url"].get().strip(), "environment": "SIMULATED", "auto_sync_enabled": self.sync_enabled, "live_entry_enabled": False}
        key = self.secret.get().strip()
        if key:
            try:
                store_secret(MCP_CREDENTIAL, key)
            except CredentialStoreError as error:
                messagebox.showerror("Secure storage unavailable", str(error))
                return False
        CONFIG_FILE.write_text(json.dumps(self.config_data, indent=2), encoding="utf-8")
        self.message.set(f"Settings saved locally. Credentials use Windows Credential Manager. Configuration: {CONFIG_FILE}")
        return True

    def test_connection(self) -> None:
        if not self.save():
            return
        if not self.secret.get().strip():
            messagebox.showinfo("MT5 key required", "Copy the MCP Bearer key from the local MT5 terminal configuration.")
            return
        self.status.set("Connecting · read-only checks")
        self.update_idletasks()
        try:
            result = asyncio.run(inspect_mt5(self.entries["mcp_url"].get().strip(), self.secret.get().strip()))
            self.message.set(f"{result.account_summary}\nRead-only tools: {', '.join(result.allowed_read_only_tools) or 'none'}\nDemo order capability requires a separate armed bot cycle.")
            self.status.set("Demo broker connected; read only" if result.ready_for_demo else "MCP connected; broker not demo-ready")
        except Exception as error:  # show a bounded diagnostic, never the secret
            self.status.set("Offline · MCP connection check failed")
            self.message.set(f"{type(error).__name__}: {str(error)[:240]}")

    def pair(self) -> None:
        if not self.save():
            return
        code = self.pair_code.get().strip().upper()
        self.status.set("Pairing · exchanging one-time code")
        self.update_idletasks()
        try:
            cloud = CloudClient(self.entries["website_url"].get().strip())
            pair_device(cloud, code, "Windows connector", store_secret)
            self.pair_code.delete(0, tk.END)
            self.status.set("Paired · read-only access")
            self.message.set("Device credential saved in Windows Credential Manager. Sync a snapshot after the MT5 read-only check succeeds.")
        except Exception as error:
            self.status.set("Pairing failed")
            self.message.set(f"{type(error).__name__}: {str(error)[:240]}")

    def sync_snapshot(self) -> None:
        if self.sync_busy or not self.save():
            return
        self.sync_busy = True
        website = self.config_data["website_url"]
        endpoint = self.config_data["mcp_url"]
        self.status.set("Syncing MT5 read-only account and positions")

        def work() -> None:
            try:
                mcp_key = read_secret(MCP_CREDENTIAL)
                device_token = read_secret(DEVICE_CREDENTIAL)
                if not mcp_key or not device_token:
                    raise ValueError("MT5 MCP key and paired device credential are both required")
                cloud = CloudClient(website)
                result = asyncio.run(sync_read_only(cloud, read_broker_snapshot, endpoint, mcp_key, device_token))
                self.sync_results.put((True, str(result.get("observedAt", "unknown time"))))
            except Exception as error:
                self.sync_results.put((False, f"{type(error).__name__}: {str(error)[:200]}"))

        threading.Thread(target=work, daemon=True).start()

    def _drain_sync_results(self) -> None:
        try:
            success, detail = self.sync_results.get_nowait()
        except queue.Empty:
            pass
        else:
            self.sync_busy = False
            self.status.set("Broker snapshot synced, read only" if success else "Snapshot sync failed; retry available")
            self.message.set(f"Account snapshot uploaded at {detail}. No order tool was called." if success else detail)
        try:
            success, detail = self.demo_results.get_nowait()
        except queue.Empty:
            pass
        else:
            self.demo_busy = False
            self.status.set("Demo bot cycle complete" if success else "Demo bot blocked")
            self.message.set(detail)
        self.after(200, self._drain_sync_results)

    def run_demo_bot(self) -> None:
        if self.demo_busy or not self.save():
            return
        self.demo_busy = True
        self.next_demo_at = time.monotonic() + 900
        website, endpoint, armed = self.config_data["website_url"], self.config_data["mcp_url"], self.demo_arm.get()
        self.status.set("Checking EURUSD DEMO bot setup" + (" · armed" if armed else " · dry run"))

        def work() -> None:
            journal = None
            try:
                key, token = read_secret(MCP_CREDENTIAL), read_secret(DEVICE_CREDENTIAL)
                if not key or not token:
                    raise ValueError("Save the MT5 MCP key and pair this device first")
                APP_DIR.mkdir(parents=True, exist_ok=True)
                journal = Journal(APP_DIR / "demo-bot.sqlite")
                outcome = asyncio.run(run_demo_cycle(CloudClient(website, timeout=30), token, endpoint, key, journal, armed))
                self.demo_results.put((True, f"{outcome.status.upper()}: {outcome.reason or 'Broker reconciliation recorded the outcome.'}"))
            except Exception as error:
                self.demo_results.put((False, f"{type(error).__name__}: {str(error)[:220]}"))
            finally:
                if journal is not None:
                    journal.close()

        threading.Thread(target=work, daemon=True).start()

    def toggle_auto_sync(self) -> None:
        self.sync_enabled = not self.sync_enabled
        self.auto_sync_button.configure(text="Pause automatic sync" if self.sync_enabled else "Resume automatic sync")
        self.save()
        if self.sync_enabled:
            self.sync_snapshot()
        else:
            def report_pause() -> None:
                try:
                    token = read_secret(DEVICE_CREDENTIAL)
                    if token:
                        CloudClient(self.config_data["website_url"]).report_status(token, "PAUSED")
                except Exception:
                    pass
            threading.Thread(target=report_pause, daemon=True).start()

    def _scheduled_sync(self) -> None:
        if self.sync_enabled and not self.sync_busy:
            self.sync_snapshot()
        if self.demo_arm.get() and self.demo_watch.get() and not self.demo_busy and time.monotonic() >= self.next_demo_at:
            self.run_demo_bot()
        self.after(15_000, self._scheduled_sync)

def run() -> None:
    lock = SingleInstanceLock(APP_DIR / "connector.lock")
    try:
        lock.acquire()
    except InstanceAlreadyRunning as error:
        messagebox.showinfo("TradeRelayCity is already running", str(error))
        return
    try:
        ConnectorApp().mainloop()
    finally:
        lock.release()

if __name__ == "__main__":
    run()
