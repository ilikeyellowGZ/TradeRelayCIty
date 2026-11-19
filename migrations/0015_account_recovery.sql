CREATE TABLE account_recovery_codes (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  created_at integer NOT NULL,
  used_at integer
);
CREATE INDEX account_recovery_codes_user_idx ON account_recovery_codes(user_id, used_at);
