# AI and database repair — 19 November 2026

The reachable Worker was `traderelaycity`, while the checked-in staging configuration selected the missing `traderelaycity-staging` Worker and used that missing hostname for authentication. The reachable Worker used the existing staging D1 database but had no AI keys. Its frontend opened the disabled simulation source, leaving the Assistant without an account.

The staging configuration now explicitly names the existing Worker and reachable origin, preserving the existing D1 ID, owner password, authentication secret, paired devices, and snapshots. Groq and Gemini secrets were set privately on that Worker. Deployment version: `ce411759-342e-4a71-93a1-aac5575bf8a6` at <https://traderelaycity.service-heyywebb.workers.dev>.

Both assistant sources now recognize the existing `AI_PROVIDER` / `AI_MODEL` settings and their configured fallback. Groq and Gemini adapters validate structured intent output. A fallback is attempted only for a transient transport failure, timeout, rate limit, or provider server error. Refusals and invalid model output do not trigger fallback. The provider receives typed text and symbol names; all answer values come from scoped database records.

The hosted frontend reads server mode before requesting data, opens the MT5 source, and does not call disabled simulation endpoints. The local fixture Assistant has an optional AI interpretation checkbox and saves both messages through its existing D1 transaction. Server errors are displayed in the broker Assistant. Migration and owner setup/reset commands explicitly name the source Wrangler configuration so generated Vite configurations cannot redirect database operations.

Verified:

- All 75 TypeScript tests pass, including new provider configuration/fallback tests and full-migration SQLite integration tests for local AI chat, message persistence, account isolation, and missing configuration.
- Local and staging database migration commands both report no pending migrations. The remote database retains two broker accounts and two snapshots; the existing connector continues syncing fresh data.
- A live local chat request returns HTTP 200, `provider=groq`, two saved messages, and an answer grounded in fixture records.
- The staging build passes and targets the existing staging D1 ID. Private `.dev.vars` is absent from the packaged output. The verified build was copied to ignored `.wrangler/ai-fix-deploy` before deployment to isolate it from concurrent local builds.
- React Doctor's changed-file scan reports no issues. Existing unrelated workspace edits were preserved.
- Hosted anonymous health returns 200 in `BROKER_READ_ONLY` mode; `/app` redirects to login; protected AI capabilities return 401; simulation routes return 404. An invalid-user login returns `INVALID_USERNAME_OR_PASSWORD`, confirming the reachable origin is accepted.
- In the existing signed-in browser session, the deployed Assistant loads MT5 records, enables the Groq option, and answers “How much cash is in my account?” with a snapshot-grounded balance and “Question classified by groq (openai/gpt-oss-20b).” Local and hosted mobile layouts were visually inspected at their existing browser emulation widths.

Gemini accepted the configured key/model listing, but live classification returned HTTP 503 with a high-demand message after an earlier timeout. Groq live classification succeeded. No database reset, owner password change, or broker order was performed.
