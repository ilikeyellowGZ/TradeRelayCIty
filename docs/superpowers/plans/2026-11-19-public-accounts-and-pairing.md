# Public Accounts and Pairing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a new person create a verified TradeRelayCity account, pair their own Windows connector, and see only their own read-only MT5 account on the shared website.

**Architecture:** Better Auth issues verified user sessions; the Worker derives the user ID from each session and the paired device owner ID from each bearer token. The existing D1 owner ID columns become per-user ownership keys. A production connector build embeds the public website origin, while each user's MT5 key and device token remain on their PC.

**Tech Stack:** React 19, TypeScript, Vite, Hono, Better Auth 1.7.x, Cloudflare Worker/D1, Resend HTTP email API, Python 3.14, PyInstaller, Vitest, Python unittest.

**Spec:** `docs/superpowers/specs/2026-11-19-public-users-live-trading-design.md`

## Global Constraints

- This plan ships public account creation and read-only per-user pairing. `LIVE_ENTRY_EXECUTION_ENABLED` remains false and no MT5 order tool is called.
- Browser routes use a verified Better Auth session; connector routes use a digest-checked device token. Never trust a browser-supplied user ID.
- MT5 MCP keys and device tokens stay in Windows Credential Manager. Resend and AI keys stay in Worker secrets.
- Public sign-up cannot be enabled on a deployed environment until a verified sending domain, `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_BASE_URL` are configured.
- The production connector's public origin is `https://traderelaycity.service-heyywebb.workers.dev` until the operator selects another origin at build time. A release cannot default to the former `traderelaycity-staging` hostname.
- All new browser writes enforce same-origin requests. Foreign and absent broker IDs receive the same 404 response.
- Treat historical `sim_users` and `sim_*` data as local fixtures, never hosted user identity.

---

## File map

| File | Responsibility |
|---|---|
| `apps/worker/src/auth-email.ts` | Small Resend transport for verification and reset messages |
| `apps/worker/src/auth.ts` | Better Auth configuration and mail callbacks |
| `apps/worker/src/auth-paths.ts` | Explicit method/path allowlist for exposed auth endpoints |
| `apps/worker/src/index.ts` | Mount allowed auth routes and verify session before `/app` |
| `apps/worker/src/broker/routes.ts` | Derive per-user owner ID and scope broker browser routes |
| `src/public/SignUpPage.tsx`, `VerifyEmailPage.tsx`, `ResetPasswordPage.tsx` | Public account lifecycle screens |
| `src/EntryRouter.tsx`, `src/App.tsx`, `src/public/PrivateAccessPage.tsx`, `LandingPage.tsx` | Route, signed-in identity, and copy updates |
| `connector/traderelaycity_connector/release_site.py` | Read website origin bundled in release |
| `connector/build-windows.ps1` | Validate and embed website origin at build time |
| `docs/friend-setup.md`, `docs/cloudflare-deployment.md` | Recipient steps and operator configuration |

### Task 1: Mail transport and auth route allowlist

**Files:** Create `apps/worker/src/auth-email.ts`, `apps/worker/src/auth-email.test.ts`, `apps/worker/src/auth-paths.ts`, and `apps/worker/src/auth-paths.test.ts`.

**Interfaces:** `sendAccountEmail(config: { apiKey: string; from: string }, message: { to: string; subject: string; text: string }, fetcher?: typeof fetch): Promise<void>` and `authPathAllowed(method: string, path: string): boolean`.

- [ ] **Step 1: Write failing tests.** Assert that `sendAccountEmail` POSTs to `https://api.resend.com/emails` with a bearer key and escaped JSON, throws a generic error on non-2xx, and never includes the key in an error. Assert that the allowlist admits only `GET /get-session`, `GET /verify-email`, and `POST /sign-up/email`, `/sign-in/username`, `/sign-out`, `/send-verification-email`, `/request-password-reset`, `/reset-password`; unknown Better Auth paths stay closed.

```ts
expect(authPathAllowed('POST', '/sign-up/email')).toBe(true)
expect(authPathAllowed('POST', '/is-username-available')).toBe(false)
expect(authPathAllowed('POST', '/sign-up/social')).toBe(false)
const fakeFetch = vi.fn(async () => new Response('{"id":"message-1"}', { status: 200 })) as unknown as typeof fetch
expect(await sendAccountEmail({ apiKey: 'secret', from: 'TradeRelayCity <hello@example.test>' },
  { to: 'user@example.test', subject: 'Verify', text: 'Open the link' }, fakeFetch)).toBeUndefined()
```

- [ ] **Step 2: Run tests to see missing-module failure.** `npm test -- apps/worker/src/auth-email.test.ts apps/worker/src/auth-paths.test.ts`.
- [ ] **Step 3: Implement the two functions.** Use a fixed Resend URL and JSON body containing `from`, `to`, `subject`, and `text`; call `AbortSignal.timeout(10000)` and reject invalid sender/recipient strings before fetch. Return a generic `Account email delivery unavailable` error; never include the HTTP response body or secret. Use a `Set` of exact `METHOD path` values in `authPathAllowed`.

```ts
const allowed = new Set(['GET /get-session', 'GET /verify-email', 'POST /sign-up/email',
  'POST /sign-in/username', 'POST /sign-out', 'POST /send-verification-email',
  'POST /request-password-reset', 'POST /reset-password'])
export const authPathAllowed = (method: string, path: string) => allowed.has(`${method} ${path}`)
```

- [ ] **Step 4: Run focused tests and build.** `npm test -- apps/worker/src/auth-email.test.ts apps/worker/src/auth-paths.test.ts`; `npm run build`. Expect all pass.
- [ ] **Step 5: Commit.** `git add apps/worker/src/auth-email.ts apps/worker/src/auth-email.test.ts apps/worker/src/auth-paths.ts apps/worker/src/auth-paths.test.ts && git commit -m "feat: add bounded account email transport"`.

### Task 2: Verified public account lifecycle

**Files:** Modify `apps/worker/src/auth.ts`, `apps/worker/src/auth.schema.ts`, `apps/worker/src/index.ts`, `apps/worker/src/auth-shell.test.ts`, `scripts/bootstrap-owner-password.ps1`; create `apps/worker/src/public-auth.test.ts` and `migrations/0014_public_auth.sql`.

**Interfaces:** Extend `AuthEnv` with `RESEND_API_KEY`, `EMAIL_FROM`; `createAuth(env)` continues to return the Better Auth instance. The public API uses the Task 1 allowlist.

- [ ] **Step 1: Write a failing route test.** Use an in-memory D1 fixture and a fake mail sender. Verify sign-up requires a username, persists an unverified user, emits a verification link, rejects an unverified `/app` session, accepts verification, then permits sign-in. Cover invalid/expired links, duplicate email response, password reset, session revocation, disabled social/passkey paths, and sender configuration missing. Inspect the actual Better Auth response shapes in the test rather than bypassing auth with a mocked session.

```ts
const unverified = await request('/api/auth/sign-up/email', {
  method: 'POST', headers: { origin: base, 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'Test User', username: 'testuser', email: 'test@example.test', password: 'long-test-password' }),
})
expect(unverified.status).toBeLessThan(400)
expect(await db.prepare('SELECT emailVerified FROM "user" WHERE username=?').bind('testuser').first()).toMatchObject({ emailVerified: 0 })
```

- [ ] **Step 2: Run the focused test and confirm it fails.** `npm test -- apps/worker/src/public-auth.test.ts`.
- [ ] **Step 3: Configure Better Auth and the Worker gate.** In `createAuth`, enable `emailAndPassword.requireEmailVerification`, use `emailVerification.sendOnSignUp`, send verification/reset mail through `sendAccountEmail`, require a 12-character minimum password, enable session revocation on reset, and add database-backed limits for sign-up, verification, and reset requests. In `index.ts`, call `authPathAllowed` before forwarding to Better Auth; require `session.user.emailVerified` before serving `/app`. Reject all public auth mutations with a foreign `Origin`. Make the bootstrap script create the internal service administrator with `emailVerified=1`; migration 0013 updates only the existing `app_settings.owner_user_id` row whose email matches `owner-%@traderelaycity.invalid`. Do not change any password hash or user session.

```ts
if (!authPathAllowed(c.req.method, path)) return c.notFound()
if (c.req.method === 'POST' && c.req.header('origin') !== new URL(c.req.url).origin)
  return c.json({ error: 'Invalid origin.' }, 403)
// After getSession in the protected route:
if (!session?.user?.emailVerified) return c.redirect('/login', 302)
// In migration 0014_public_auth.sql:
UPDATE "user" SET "emailVerified"=1
WHERE id=(SELECT value FROM app_settings WHERE key='owner_user_id')
  AND email LIKE 'owner-%@traderelaycity.invalid';
```

- [ ] **Step 4: Run tests and build.** `npm test -- apps/worker/src/public-auth.test.ts apps/worker/src/auth-shell.test.ts`; `npm run build`. Compare the generated Better Auth schema with `migrations/0002_better_auth.sql` and `0008_owner_username_password.sql`; add any required schema delta to migration 0013 and verify it applies to a fresh and existing database.
- [ ] **Step 5: Commit.** Stage only the auth code, tests, and any verified migration; commit `feat: enable verified public accounts`.

### Task 3: Per-user broker authorization and pairing

**Files:** Modify `apps/worker/src/broker/routes.ts`, `apps/worker/src/broker/routes.test.ts`, `apps/worker/src/index.ts` if route export names change. No D1 ownership migration is required because `connector_*`, `broker_accounts`, `broker_snapshots`, and `broker_ai_daily_usage` already carry a user ID through their parent or own `owner_id`.

**Interfaces:** Browser middleware sets `ownerId` to `session.user.id` for every verified user. Device middleware still resolves `deviceOwnerId` from the token digest. All API response shapes remain compatible with the current Broker page and connector.

- [ ] **Step 1: Replace owner-only test expectations with two-user ownership tests.** User A and B each create a pairing code, pair distinct devices, upload snapshots, and see only their own devices/accounts. User B cannot read, revoke, question, or generate AI answers for A's account. An unverified user and foreign-origin mutation are rejected. Test replayed code and revoked token after both users exist.

```ts
expect((await request('/api/broker/accounts', { headers: userBHeaders }).then(r => r.json())
  as { accounts: Array<{ id: string }> }).accounts.map(a => a.id)).toEqual([accountBId])
expect((await request(`/api/broker/accounts/${accountAId}/questions`, {
  method: 'POST', headers: userBHeaders, body: JSON.stringify({ question: 'What is my balance?' }),
})).status).toBe(404)
```

- [ ] **Step 2: Run focused tests to confirm the owner-only middleware fails.** `npm test -- apps/worker/src/broker/routes.test.ts`.
- [ ] **Step 3: Remove the `app_settings.owner_user_id` equality check from broker middleware.** Reject missing or unverified sessions; set `ownerId` from the verified session; keep all existing owner-scoped SQL and device-token checks. Ensure every query with a broker/device/account ID includes the resolved owner ID, including questions, status events, revocation, and AI usage. Keep `owner_user_id` only for administrator functions outside the user broker API.

```ts
const session = await createAuth(authEnv).api.getSession({ headers: c.req.raw.headers })
if (!session?.user?.emailVerified) return c.json({ error: 'Sign in required.' }, 401)
c.set('ownerId', session.user.id)
```

- [ ] **Step 4: Run route tests, all TypeScript tests, and build.** `npm test -- apps/worker/src/broker/routes.test.ts`; `npm test`; `npm run build`. Expect two users' data to remain disjoint and current connector payloads to pass.
- [ ] **Step 5: Commit.** `git add apps/worker/src/broker/routes.ts apps/worker/src/broker/routes.test.ts apps/worker/src/index.ts && git commit -m "feat: scope broker accounts to each verified user"`.

### Task 4: Public sign-up and recovery screens

**Files:** Create `src/public/SignUpPage.tsx`, `src/public/VerifyEmailPage.tsx`, `src/public/ResetPasswordPage.tsx`, `src/public/SignUpPage.test.tsx`; modify `src/EntryRouter.tsx`, `src/App.tsx`, `src/public/PrivateAccessPage.tsx`, `src/public/LandingPage.tsx`, `src/public/public.css`, `package.json`, and `package-lock.json` for `@testing-library/react` and `jsdom` test dependencies.

**Interfaces:** `/signup` submits `authClient.signUp.email`; `/verify-email` confirms the Better Auth link and offers resend; `/forgot-password` requests reset; `/reset-password` consumes a token. `/login` retains username/password sign-in.

- [ ] **Step 1: Write route/form tests for required fields, generic recovery response, invalid verification/reset links, and success navigation.** Install `@testing-library/react` and `jsdom` as locked dev dependencies and use `// @vitest-environment jsdom` in the test file. Mock `authClient` methods; assert visible text and calls rather than snapshotting markup.

```tsx
// @vitest-environment jsdom
render(<SignUpPage />)
fireEvent.click(screen.getByRole('button', { name: /create account/i }))
expect(screen.getByRole('alert').textContent).toContain('Enter')
expect(authClient.signUp.email).not.toHaveBeenCalled()
```

- [ ] **Step 2: Run focused tests and observe the missing pages.** `npm test -- src/public/SignUpPage.test.tsx`.
- [ ] **Step 3: Implement the screens using the existing `AccessFrame` and button/input styles.** Add links from the landing and login pages. Show the same generic confirmation for unknown and known reset email addresses. Keep the verification token in the link flow only, never local storage. Update private-owner copy to user workspace copy. If Better Auth redirects to a callback URL, use `/verify-email` and then route to `/login` after success. In `App.tsx`, replace the hard-coded `Jordan Davis` sidebar identity with the verified session user's name, and route hosted Assistant views to the broker source by default; keep fixture persona controls local-only.

```tsx
const result = await authClient.signUp.email({ name, username, email, password, callbackURL: '/verify-email' })
if (result.error) setError(result.error.status === 429 ? 'Please wait before trying again.' : 'Could not create your account.')
else window.location.assign('/verify-email?sent=1')
// In App.tsx after getSession():
const [displayName, setDisplayName] = useState('Your workspace')
setDisplayName(result.data?.user?.name ?? 'Your workspace')
// Pass displayName to Sidebar and render it where `Jordan Davis` is currently hard-coded.
```

- [ ] **Step 4: Run browser and build checks.** Test 320px and 390px widths, keyboard navigation, and each success/error state with the repository Playwright CLI; run `npm test`, `npm run build`, and the repository `react-doctor` skill on changed React files.
- [ ] **Step 5: Commit.** Stage the public UI files and focused tests; commit `feat: add public account setup screens`.

### Task 5: Recipient setup and connector origin

**Files:** Create `connector/traderelaycity_connector/release_site.py` and `connector/tests/test_release_site.py`; modify `connector/traderelaycity_connector/main.py`, `connector/build-windows.ps1`, `connector/config.example.json`, `docs/friend-setup.md`, `docs/windows-connector.md`, `docs/cloudflare-deployment.md`, `README.md`.

**Interfaces:** `release_site.validate_release_origin(value: str) -> str` validates a public HTTPS origin; `release_site.default_website_url() -> str` reads a bundled public-origin text file. `build-windows.ps1 -WebsiteUrl <https origin>` validates and embeds it. Existing user config under `%LOCALAPPDATA%/TradeRelayCity` still overrides the bundled default.

- [ ] **Step 1: Write failing Python tests for a valid HTTPS origin, malformed/credential-bearing origin, missing bundle value, and user config override.** Assert no private token appears in the release file. Verify the website's download URL points to the packaged executable.

```python
self.assertEqual(validate_release_origin("https://traderelaycity.service-heyywebb.workers.dev"),
                 "https://traderelaycity.service-heyywebb.workers.dev")
with self.assertRaises(ValueError):
    validate_release_origin("https://user:pass@example.com/path")
```

- [ ] **Step 2: Run the focused Python test and confirm it fails.** `connector/.venv/Scripts/python.exe -m unittest discover -s connector/tests -p test_release_site.py -v`.
- [ ] **Step 3: Implement the release origin and build parameter.** Reuse `cloud_client.validate_website_url`, require HTTPS for a release origin, and embed a public text asset with PyInstaller `--add-data`. Read the asset from `sys._MEIPASS` at runtime and use it in both the initial config and website field. Fail the build when no valid origin is supplied; document `./build-windows.ps1 -WebsiteUrl https://traderelaycity.service-heyywebb.workers.dev`. Do not overwrite a user's existing saved URL or credentials during upgrades.

```powershell
param([Parameter(Mandatory=$true)][string]$WebsiteUrl)
if ($WebsiteUrl -notmatch '^https://[^/@?#]+/?$') { throw 'Release website URL must be an HTTPS origin.' }
```

- [ ] **Step 4: Rewrite the recipient guide to match the actual flow.** Include sign-up, email verification, MT5 install/sign-in, MCP key, pairing, account confirmation, read-only sync, and current trading status. Verify the packaged default origin, executable SHA-256 copy, and website asset. Run Python unittest, `npm test`, and `npm run build`.
- [ ] **Step 5: Commit.** Stage only connector source/tests/build script and recipient/deployment docs; commit `feat: package connector for public website onboarding`.

### Task 6: Deployed read-only handoff check

**Files:** Modify `docs/validation-report.md` and `docs/integration-checklist.md`; add a focused smoke script under `scripts/` only if repeated manual calls are error-prone.

**Interfaces:** A fresh non-admin account can sign up, verify, pair, upload, read, revoke, and sign out on the selected hosted URL. A second account cannot see its records.

- [ ] **Step 1: Run local migration and auth/broker tests.** `npm run db:migrate:local`; `npm test`; `npm run build`. Confirm no `.dev.vars` appears under `dist`.
- [ ] **Step 2: Configure the selected staging environment.** Set `RESEND_API_KEY` as a Wrangler secret and `EMAIL_FROM` and `APP_BASE_URL` as environment variables for a verified sending domain; apply the existing D1 migrations. Use the existing staging build/deploy procedure in `docs/cloudflare-deployment.md` and check the generated D1 binding before deployment.
- [ ] **Step 3: Run a clean-user smoke.** Register two staging-only disposable users, verify each email, sign in as A, pair a test connector and upload a synthetic read-only snapshot through the existing test client, then confirm A sees it and B sees no devices/accounts. Revoke A's device and confirm its token gets 401. Repeat once with a connected demo MT5 terminal. Keep the staging test users isolated from production and do not expose tokens or broker login in validation logs.

```text
Expected: A account count = 1; B account count = 0; revoked token upload = HTTP 401;
GET /api/health remains BROKER_READ_ONLY; no order tool invoked.
```

- [ ] **Step 4: Record the exact tested URL, connector hash, migration state, email delivery, test results, and any remaining broker limits.** Update `docs/validation-report.md` and `docs/integration-checklist.md`; commit `docs: verify public read-only onboarding`.

## Self-review checklist

- [ ] All public auth paths are explicitly allowlisted and all protected routes require verified email.
- [ ] Two real user IDs are used in broker tests; no route can read or mutate the other's devices/accounts.
- [ ] The release executable defaults to the same origin as the deployed website and contains no keys.
- [ ] The recipient guide describes only working, tested behavior; live automatic trading remains visibly disabled.

## Next plans

After this plan passes, follow `docs/trading-delivery-map.md`. The later broker and execution plans must use the actual discovered MT5 schemas and demo evidence; guessing those schemas would make an unsafe executable plan.

## References

- [Better Auth username sign-up](https://better-auth.com/docs/plugins/username)
- [Better Auth email verification and reset](https://better-auth.com/docs/authentication/email-password)
- [Resend HTTP sending](https://resend.com/cloudflare)
