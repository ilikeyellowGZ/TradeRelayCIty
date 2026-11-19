-- The bootstrap owner has an internal non-deliverable email. Mark only that
-- existing service administrator as verified before enforcing email checks.
UPDATE "user" SET "emailVerified" = 1
WHERE id = (SELECT value FROM app_settings WHERE key = 'owner_user_id')
  AND email LIKE 'owner-%@traderelaycity.invalid';
