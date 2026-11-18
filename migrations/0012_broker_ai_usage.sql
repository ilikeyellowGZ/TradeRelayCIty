CREATE TABLE broker_ai_daily_usage (
  owner_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  day_utc TEXT NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count BETWEEN 1 AND 30),
  PRIMARY KEY (owner_id, day_utc)
);
