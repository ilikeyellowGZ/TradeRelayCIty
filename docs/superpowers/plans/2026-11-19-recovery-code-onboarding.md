# Recovery-code public onboarding revision

Date: 19 November 2026. User decision: public signup uses username/password and one-time recovery codes, with no email provider or email address required.

## Account flow

1. The public `/signup` form submits name, username, and password to `POST /api/account/register`. The server validates and rate limits the request, creates the Better Auth credential account with a unique synthetic `.invalid` email, and atomically stores eight keyed recovery-code hashes. Plaintext codes are returned once.
2. The user saves the codes, acknowledges this on the page, and signs in through Better Auth's username endpoint. A signed-in user can access only their own broker records. Email signup, email sign-in, verification, and email reset endpoints stay closed.
3. `/forgot-password` accepts username, one unused code, and a new password. The server rate limits attempts and atomically changes the credential hash, revokes sessions, and marks the code used. Replays fail.
4. The signed-in **Security** page allows code rotation only after current-password verification. It replaces all previous codes atomically and displays the new codes once. If both password and codes are lost, there is no automatic recovery path.

## Release checks

- Run `npm test`, `npm run build`, and `npx react-doctor@latest --verbose --scope changed`.
- Apply `0015_account_recovery.sql` after earlier migrations; keep `BETTER_AUTH_SECRET` stable because it keys code hashes.
- Build the connector with the exact hosted `-WebsiteUrl`, verify source, public, and built-asset SHA-256 values match, and confirm no secret files enter `dist`.
- On a disposable hosted environment, register two users, save codes, sign in, pair separate devices, verify isolation, reset and rotate codes, revoke a device, and test a connected demo MT5 snapshot before inviting recipients.
- Keep live-account order execution disabled. A separately armed local demo bot was added in parallel; its real broker fill and reconciliation remain unverified. Automatic live trading is a later delivery phase.
