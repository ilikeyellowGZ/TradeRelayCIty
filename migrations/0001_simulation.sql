PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sim_users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sim_accounts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL UNIQUE REFERENCES sim_users(id),
  label TEXT NOT NULL,
  broker TEXT NOT NULL,
  server TEXT NOT NULL,
  login TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment = 'DEMO'),
  mode TEXT NOT NULL CHECK (mode = 'SIMULATED'),
  is_live INTEGER NOT NULL DEFAULT 0 CHECK (is_live = 0),
  currency TEXT NOT NULL,
  balance REAL NOT NULL,
  equity REAL NOT NULL,
  daily_pnl REAL NOT NULL,
  connected INTEGER NOT NULL DEFAULT 0 CHECK (connected IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sim_positions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES sim_accounts(id),
  symbol TEXT NOT NULL,
  description TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  volume REAL NOT NULL CHECK (volume > 0),
  entry REAL NOT NULL,
  market REAL NOT NULL,
  pnl REAL NOT NULL,
  source TEXT NOT NULL CHECK (source = 'SIMULATED')
);

CREATE TABLE IF NOT EXISTS sim_commands (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES sim_users(id),
  account_id TEXT NOT NULL REFERENCES sim_accounts(id),
  idempotency_key TEXT NOT NULL UNIQUE,
  operation TEXT NOT NULL CHECK (operation IN ('OPEN', 'CLOSE', 'HOLD')),
  symbol TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'claimed', 'submitting', 'filled', 'partially_filled', 'rejected', 'expired', 'cancelled', 'unknown')),
  note TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sim_decisions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES sim_users(id),
  decision TEXT NOT NULL CHECK (decision IN ('HOLD', 'BUY', 'SELL')),
  rationale TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sim_events (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES sim_users(id),
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS sim_accounts_owner_idx ON sim_accounts(owner_id);
CREATE INDEX IF NOT EXISTS sim_positions_account_idx ON sim_positions(account_id);
CREATE INDEX IF NOT EXISTS sim_commands_owner_status_idx ON sim_commands(owner_id, status);

INSERT OR IGNORE INTO sim_users (id, display_name, role) VALUES
  ('sim-owner', 'Jordan Davis', 'owner'),
  ('sim-trader-1', 'Morgan Lee', 'member'),
  ('sim-trader-2', 'Taylor Reed', 'member');

INSERT OR IGNORE INTO sim_accounts (id, owner_id, label, broker, server, login, environment, mode, is_live, currency, balance, equity, daily_pnl, connected) VALUES
  ('sim-account-owner', 'sim-owner', 'Owner demo account', 'Simulation Broker', 'TRC-SIM-DEMO', 'SIM-001', 'DEMO', 'SIMULATED', 0, 'USD', 24580.00, 24764.32, 184.32, 1),
  ('sim-account-1', 'sim-trader-1', 'Morgan''s demo account', 'Simulation Broker', 'TRC-SIM-DEMO', 'SIM-002', 'DEMO', 'SIMULATED', 0, 'USD', 12400.00, 12442.18, 42.18, 1),
  ('sim-account-2', 'sim-trader-2', 'Taylor''s demo account', 'Simulation Broker', 'TRC-SIM-DEMO', 'SIM-003', 'DEMO', 'SIMULATED', 0, 'USD', 18250.00, 18198.60, -51.40, 0);

INSERT OR IGNORE INTO sim_positions (id, account_id, symbol, description, side, volume, entry, market, pnl, source) VALUES
  ('sim-position-0-0', 'sim-account-owner', 'EURUSD', 'Euro / US Dollar', 'BUY', .12, 1.08420, 1.08634, 25.68, 'SIMULATED'),
  ('sim-position-0-1', 'sim-account-owner', 'GBPUSD', 'British Pound / US Dollar', 'SELL', .08, 1.27150, 1.27310, -12.80, 'SIMULATED'),
  ('sim-position-0-2', 'sim-account-owner', 'XAUUSD', 'Gold / US Dollar', 'BUY', .03, 2331.80, 2338.10, 18.90, 'SIMULATED'),
  ('sim-position-1-0', 'sim-account-1', 'EURUSD', 'Euro / US Dollar', 'BUY', .06, 1.08420, 1.08510, 5.40, 'SIMULATED'),
  ('sim-position-2-0', 'sim-account-2', 'GBPUSD', 'British Pound / US Dollar', 'SELL', .04, 1.27150, 1.27240, -3.60, 'SIMULATED'),
  ('sim-position-2-1', 'sim-account-2', 'XAUUSD', 'Gold / US Dollar', 'BUY', .02, 2331.80, 2332.90, 2.20, 'SIMULATED');

INSERT OR IGNORE INTO sim_commands (id, owner_id, account_id, idempotency_key, operation, symbol, status, note, expires_at, attempts) VALUES
  ('sim-command-0-pending', 'sim-owner', 'sim-account-owner', 'seed-0-pending', 'HOLD', 'EURUSD', 'pending', 'No confirmed setup; explicit HOLD fixture.', datetime('now', '+5 minutes'), 0),
  ('sim-command-0-expired', 'sim-owner', 'sim-account-owner', 'seed-0-expired', 'OPEN', 'GBPUSD', 'expired', 'Expired before connector claim.', datetime('now', '-10 minutes'), 0),
  ('sim-command-0-rejected', 'sim-owner', 'sim-account-owner', 'seed-0-rejected', 'OPEN', 'XAUUSD', 'rejected', 'Rejected by deterministic risk guard.', datetime('now', '-2 minutes'), 1),
  ('sim-command-1-pending', 'sim-trader-1', 'sim-account-1', 'seed-1-pending', 'HOLD', 'EURUSD', 'pending', 'No confirmed setup; explicit HOLD fixture.', datetime('now', '+5 minutes'), 0),
  ('sim-command-1-expired', 'sim-trader-1', 'sim-account-1', 'seed-1-expired', 'OPEN', 'GBPUSD', 'expired', 'Expired before connector claim.', datetime('now', '-10 minutes'), 0),
  ('sim-command-1-rejected', 'sim-trader-1', 'sim-account-1', 'seed-1-rejected', 'OPEN', 'XAUUSD', 'rejected', 'Rejected by deterministic risk guard.', datetime('now', '-2 minutes'), 1),
  ('sim-command-2-pending', 'sim-trader-2', 'sim-account-2', 'seed-2-pending', 'HOLD', 'EURUSD', 'pending', 'No confirmed setup; explicit HOLD fixture.', datetime('now', '+5 minutes'), 0),
  ('sim-command-2-expired', 'sim-trader-2', 'sim-account-2', 'seed-2-expired', 'OPEN', 'GBPUSD', 'expired', 'Expired before connector claim.', datetime('now', '-10 minutes'), 0),
  ('sim-command-2-rejected', 'sim-trader-2', 'sim-account-2', 'seed-2-rejected', 'OPEN', 'XAUUSD', 'rejected', 'Rejected by deterministic risk guard.', datetime('now', '-2 minutes'), 1);

INSERT OR IGNORE INTO sim_decisions (id, owner_id, decision, rationale) VALUES
  ('sim-decision-0', 'sim-owner', 'HOLD', 'No confirmed setup; the simulation never forces an entry.'),
  ('sim-decision-1', 'sim-trader-1', 'HOLD', 'No confirmed setup; the simulation never forces an entry.'),
  ('sim-decision-2', 'sim-trader-2', 'HOLD', 'No confirmed setup; the simulation never forces an entry.');

INSERT OR IGNORE INTO sim_events (id, owner_id, kind, message) VALUES
  ('sim-event-0', 'sim-owner', 'snapshot_refreshed', 'Simulated account snapshot refreshed.'),
  ('sim-event-1', 'sim-trader-1', 'snapshot_refreshed', 'Simulated account snapshot refreshed.'),
  ('sim-event-2', 'sim-trader-2', 'connector_disconnected', 'Connector offline; no new commands are submitted.');
