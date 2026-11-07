"""Durable, bounded SQLite command journal for local crash recovery."""
from __future__ import annotations

import sqlite3
from pathlib import Path

class Journal:
    def __init__(self, path: Path):
        self.connection = sqlite3.connect(path, timeout=5, isolation_level=None)
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("PRAGMA journal_mode=WAL")
        self.connection.execute("PRAGMA foreign_keys=ON")
        self.connection.executescript("""
        CREATE TABLE IF NOT EXISTS commands (
          command_id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, account_binding TEXT NOT NULL,
          operation TEXT NOT NULL, status TEXT NOT NULL, intent_json TEXT NOT NULL,
          broker_reference TEXT, result_json TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS spool (
          id INTEGER PRIMARY KEY, event_key TEXT NOT NULL UNIQUE, payload_json TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY, level TEXT NOT NULL, code TEXT NOT NULL, message TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """)

    def persist_intent(self, command_id: str, idempotency_key: str, account_binding: str, operation: str, intent_json: str) -> None:
        self.connection.execute(
            "INSERT OR IGNORE INTO commands(command_id,idempotency_key,account_binding,operation,status,intent_json) VALUES(?,?,?,?,?,?)",
            (command_id, idempotency_key, account_binding, operation, "intent_persisted", intent_json),
        )

    def set_status(self, command_id: str, status: str, result_json: str | None = None) -> None:
        self.connection.execute("UPDATE commands SET status=?, result_json=COALESCE(?,result_json), updated_at=CURRENT_TIMESTAMP WHERE command_id=?", (status, result_json, command_id))

    def unresolved(self) -> list[sqlite3.Row]:
        return list(self.connection.execute("SELECT * FROM commands WHERE status IN ('intent_persisted','submitting','unknown') ORDER BY updated_at"))

    def enqueue_event(self, event_key: str, payload_json: str, max_items: int = 500) -> None:
        self.connection.execute("INSERT OR IGNORE INTO spool(event_key,payload_json) VALUES(?,?)", (event_key, payload_json))
        self.connection.execute("DELETE FROM spool WHERE id NOT IN (SELECT id FROM spool ORDER BY id DESC LIMIT ?)", (max_items,))

    def close(self) -> None:
        self.connection.close()
