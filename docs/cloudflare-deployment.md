# Cloudflare deployment

Deployment is not performed from this workspace: a Cloudflare account, D1 database ID, domain choice, and owner bootstrap are required.

## Local first

```powershell
npm ci
Copy-Item .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

The local database is stored under `.wrangler/state` (ignored). `scripts/setup.ps1` generates a local-only Better Auth secret in the ignored `.dev.vars`; this value is never shipped in the production bundle.

## Create a free-tier Worker and D1

1. Create/sign into a Cloudflare account and install the Cloudflare CLI tools via the project's locked `wrangler` dependency.
2. Run `npx wrangler login` and choose the account.
3. Run `npx wrangler d1 create traderelaycity`. Copy the returned database ID into `wrangler.jsonc` in place of `REPLACE_AFTER_CREATING_D1`.
4. Set the production `APP_BASE_URL` in `wrangler.jsonc` after choosing a domain. Add `APP_BASE_URL` as a Worker variable and set `BETTER_AUTH_SECRET` using `npx wrangler secret put BETTER_AUTH_SECRET` with a newly generated value.
5. Apply reviewed migrations with `npm run db:migrate:remote`.
6. Run `./scripts/bootstrap-owner.ps1` in PowerShell. It creates a one-time 48-hour invitation in D1 and prints the link. Open it yourself to create the owner's passkey. The script stores only the invitation hash in D1 and deletes its temporary SQL file.
7. Only after owner enrollment and auth verification, deploy using `npm run deploy`.
8. Confirm the deployed `/api/health` response, then confirm simulation routes return 404 on the deployed hostname.

Do not set `SIMULATION_MODE=true` in production. `wrangler deploy` currently must not be run until the D1 ID is replaced, auth and invite migrations are applied, and owner passkey enrollment has been verified. The Worker must not be described as a resident trading process: connector polling happens from each user's PC.

For production passkeys, use the exact HTTPS application origin as `APP_BASE_URL`; the RP ID is derived from its hostname. A hostname change requires passkey origin review. A paid custom domain is optional; Cloudflare's `workers.dev` address can be used if its supported origin is accepted by the planned enrollment flow.
