-- Reviewed delta from the Better Auth 1.7.18 CLI schema with the username plugin
-- and database-backed rate limiting. Existing passkey rows remain inert.
ALTER TABLE "user" ADD COLUMN "username" text;
CREATE UNIQUE INDEX IF NOT EXISTS "user_username_idx" ON "user" ("username");

CREATE TABLE IF NOT EXISTS "rateLimit" (
  "id" text NOT NULL PRIMARY KEY,
  "key" text NOT NULL UNIQUE,
  "count" integer NOT NULL,
  "lastRequest" bigint NOT NULL
);
