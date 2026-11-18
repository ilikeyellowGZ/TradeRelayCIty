# Cloudflare deployment

The existing hosted workspace is `https://traderelaycity.service-heyywebb.workers.dev`. The `staging` configuration explicitly targets Worker `traderelaycity` and the existing `traderelaycity-staging` D1 database. `APP_BASE_URL` must match that reachable origin for password login to work. The former `traderelaycity-staging` hostname has no Worker. A separate production database and owner setup remain unconfigured.

## Deploy staging

Use `npm run db:migrate:staging` for the hosted database or `npm run db:migrate:local` for the local database. These commands explicitly select the source configuration, so a previous Vite build cannot redirect them to another database. Supply `GROQ_API_KEY` and `GEMINI_API_KEY` using private stdin to `wrangler secret bulk --config wrangler.jsonc --env staging`. Preserve the existing `BETTER_AUTH_SECRET` and owner password.

Set `CLOUDFLARE_ENV=staging` for the build, then inspect `dist/traderelaycity/wrangler.json` to confirm `targetEnvironment` is `staging` and the D1 binding is `traderelaycity-staging`. Run `npx wrangler deploy` without `--env` against this generated Vite configuration. Adding `--env staging` to the deploy command selects the top-level D1 placeholder and fails with Cloudflare error 10021. Keep the production placeholder untouched.

```powershell
$env:CLOUDFLARE_ENV = 'staging'
try { npm run build; if ($LASTEXITCODE -ne 0) { throw 'Staging build failed.' } }
finally { Remove-Item Env:CLOUDFLARE_ENV -ErrorAction SilentlyContinue }
npx wrangler deploy
```

The staging website serves `TradeRelayCity-Connector-Windows.exe` directly. The current executable is unsigned and may be blocked by Windows Smart App Control until a trusted code signature is added. A successful deployment does not validate owner sign-in or a broker-connected MT5 snapshot; run those checks separately.

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
8. Confirm the deployed `/api/health` response, an unsigned `/app` request redirects to `/login`, and simulation routes return 404 on the deployed hostname.

Do not set `SIMULATION_MODE=true` in production. `wrangler deploy` must not be run until the D1 ID is replaced, migrations are applied, the owner credential is set, and remote login behavior is verified. The Worker is not a resident trading process: connector polling happens from each user's PC.

Use the exact HTTPS application origin as `APP_BASE_URL` so same-origin session cookies and sign-in requests work. A paid custom domain is optional; a Cloudflare `workers.dev` address can be used.
