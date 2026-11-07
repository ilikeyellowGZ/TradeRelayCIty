from __future__ import annotations

import asyncio
import json
import os
import sys
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, ttk

from .mcp_adapter import inspect_mt5
from .instance_lock import InstanceAlreadyRunning, SingleInstanceLock
from .secure_store import CredentialStoreError, read_secret, store_secret

APP_DIR = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "TradeRelayCity"
CONFIG_FILE = APP_DIR / "config.json"
MCP_CREDENTIAL = "TradeRelayCity/mt5-mcp"

def load_config() -> dict:
    if CONFIG_FILE.exists():
        try:
            return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
    return {"website_url": "https://example.invalid", "mcp_url": "http://127.0.0.1:22346/mcp", "environment": "SIMULATED", "live_entry_enabled": False}

class ConnectorApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("TradeRelayCity Connector")
        self.geometry("600x535")
        self.minsize(520, 485)
        self.configure(bg="#f7f5f0")
        self.config_data = load_config()
        self.status = tk.StringVar(value="Offline · no account bound")
        self.message = tk.StringVar(value="Simulation is the default. Test connection only reads MT5 account capabilities.")
        self._build()

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
            ("TradeRelayCity website URL", "website_url", "https://your-domain.example"),
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
        ttk.Label(outer, text="Execution mode: SIMULATED · Live entry execution disabled", foreground="#8e2535").pack(anchor="w", pady=(16, 5))
        row = ttk.Frame(outer)
        row.pack(fill="x", pady=(9, 11))
        ttk.Button(row, text="Save local settings", command=self.save).pack(side="left")
        ttk.Button(row, text="Test connection (read only)", command=self.test_connection).pack(side="right")
        ttk.Separator(outer).pack(fill="x", pady=7)
        ttk.Label(outer, textvariable=self.message, style="Hint.TLabel").pack(fill="x", anchor="w")
        ttk.Label(outer, text="A successful MCP handshake does not authorize trading. Account binding and required risk capabilities still need verification.", style="Hint.TLabel").pack(fill="x", anchor="w", pady=(14, 0))

    def save(self) -> None:
        APP_DIR.mkdir(parents=True, exist_ok=True)
        self.config_data = {"website_url": self.entries["website_url"].get().strip(), "mcp_url": self.entries["mcp_url"].get().strip(), "environment": "SIMULATED", "live_entry_enabled": False}
        CONFIG_FILE.write_text(json.dumps(self.config_data, indent=2), encoding="utf-8")
        key = self.secret.get().strip()
        if key:
            try:
                store_secret(MCP_CREDENTIAL, key)
            except CredentialStoreError as error:
                messagebox.showerror("Secure storage unavailable", str(error))
                return
        self.message.set(f"Settings saved locally. Credentials use Windows Credential Manager. Configuration: {CONFIG_FILE}")

    def test_connection(self) -> None:
        self.save()
        if not self.secret.get().strip():
            messagebox.showinfo("MT5 key required", "Copy the MCP Bearer key from the local MT5 terminal configuration.")
            return
        self.status.set("Connecting · read-only checks")
        self.update_idletasks()
        try:
            result = asyncio.run(inspect_mt5(self.entries["mcp_url"].get().strip(), self.secret.get().strip()))
            self.message.set(f"{result.account_summary}\nRead-only tools: {', '.join(result.allowed_read_only_tools) or 'none'}\nTrading capabilities remain blocked.")
            self.status.set("Connected · account binding not confirmed")
        except Exception as error:  # show a bounded diagnostic, never the secret
            self.status.set("Offline · MCP connection check failed")
            self.message.set(f"{type(error).__name__}: {str(error)[:240]}")

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
