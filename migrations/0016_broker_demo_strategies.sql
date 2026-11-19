CREATE TABLE broker_demo_strategies (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES broker_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  config_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0,1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX broker_demo_strategies_account ON broker_demo_strategies(account_id,updated_at DESC);
CREATE UNIQUE INDEX broker_demo_strategies_one_active ON broker_demo_strategies(account_id) WHERE active=1;
