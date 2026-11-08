# Cloudflare deployment

Deployment is not performed from this workspace: a Cloudflare account, D1 database ID, domain choice, and owner bootstrap are required.

## Local first

```powershell
./scripts/setup.ps1
./scripts/bootstrap-owner-password.ps1
npm run dev
```

The local database is stored under `.wrangler/state` (ignored). `scripts/setup.ps1` generates a local-only Better Auth secret in the ignored `.dev.vars`; this value is never shipped in the production bundle.

## Create a free-tier Worker and D1

1. Create/sign into a Cloudflare account and install the Cloudflare CLI tools via the project's locked `wrangler` dependency.
2. Run `npx wrangler login` and choose the account.
3. Run `npx wrangler d1 create traderelaycity`. Copy the returned database ID into `wrangler.jsonc` in place of `REPLACE_AFTER_CREATING_D1`.
4. Set the production `APP_BASE_URL` in `wrangler.jsonc` after choosing a domain. Add `APP_BASE_URL` as a Worker variable and set `BETTER_AUTH_SECRET` using `npx wrangler secret put BETTER_AUTH_SECRET` with a newly generated value.
5. Apply reviewed migrations with `npm run db:migrate:remote`.
6. Run `./scripts/bootstrap-owner-password.ps1 -Remote` in PowerShell. Enter and confirm your chosen password in the hidden prompts. The script creates the owner account with username `iluvpistachioos` and stores only Better Auth's password hash in D1. It will not replace an existing owner.
7. After checking local login, session expiry, sign-out, and Worker CPU usage, deploy using `npm run deploy`.
8. Confirm the deployed `/api/health` response, then confirm simulation routes return 404 on the deployed hostname.

Do not set `SIMULATION_MODE=true` in production. `wrangler deploy` must not be run until the D1 ID is replaced, migrations are applied, the owner credential is set, and remote login behavior is verified. The Worker is not a resident trading process: connector polling happens from each user's PC.

Use the exact HTTPS application origin as `APP_BASE_URL` so same-origin session cookies and sign-in requests work. A paid custom domain is optional; a Cloudflare `workers.dev` address can be used.
