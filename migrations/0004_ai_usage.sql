CREATE TABLE IF NOT EXISTS ai_usage_daily (
  user_id TEXT NOT NULL REFERENCES sim_users(id),
  owner_id TEXT NOT NULL REFERENCES sim_users(id),
  usage_date TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  token_count INTEGER NOT NULL DEFAULT 0 CHECK (token_count >= 0),
  user_limit INTEGER NOT NULL CHECK (user_limit >= 0),
  owner_limit INTEGER NOT NULL CHECK (owner_limit >= 0),
  PRIMARY KEY (user_id, usage_date)
);
CREATE INDEX IF NOT EXISTS ai_usage_owner_date_idx ON ai_usage_daily(owner_id, usage_date);
INSERT OR IGNORE INTO ai_usage_daily(user_id,owner_id,usage_date,request_count,token_count,user_limit,owner_limit)
SELECT id, 'sim-owner', date('now'), 0, 0, CASE WHEN id = 'sim-trader-2' THEN 0 ELSE 10 END, 30 FROM sim_users;
