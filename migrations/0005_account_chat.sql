PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sim_chat_conversations (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES sim_users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES sim_accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL DEFAULT (datetime('now', '+90 days'))
);

CREATE TABLE IF NOT EXISTS sim_chat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES sim_chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL CHECK (length(content) <= 6000),
  citations_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sim_chat_usage_daily (
  user_id TEXT NOT NULL REFERENCES sim_users(id) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  daily_limit INTEGER NOT NULL DEFAULT 20 CHECK (daily_limit >= 0),
  PRIMARY KEY (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS sim_chat_conversations_owner_account_idx ON sim_chat_conversations(owner_id, account_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS sim_chat_messages_conversation_idx ON sim_chat_messages(conversation_id, created_at);
