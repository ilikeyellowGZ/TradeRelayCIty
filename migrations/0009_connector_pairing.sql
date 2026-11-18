CREATE TABLE IF NOT EXISTS connector_pairing_codes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  code_digest TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS connector_pairing_owner_idx ON connector_pairing_codes(owner_id, expires_at);

CREATE TABLE IF NOT EXISTS connector_pairing_attempts (
  ip_digest TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL,
  PRIMARY KEY (ip_digest, window_start)
);

CREATE TABLE IF NOT EXISTS connector_devices (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_digest TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS connector_devices_owner_idx ON connector_devices(owner_id, revoked_at);

CREATE TABLE IF NOT EXISTS broker_accounts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL UNIQUE REFERENCES connector_devices(id) ON DELETE CASCADE,
  broker TEXT NOT NULL,
  server TEXT NOT NULL,
  login TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('DEMO','LIVE')),
  currency TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS broker_accounts_owner_idx ON broker_accounts(owner_id);

CREATE TABLE IF NOT EXISTS broker_snapshots (
  account_id TEXT PRIMARY KEY REFERENCES broker_accounts(id) ON DELETE CASCADE,
  balance REAL NOT NULL,
  equity REAL NOT NULL,
  positions_json TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  received_at INTEGER NOT NULL
);
