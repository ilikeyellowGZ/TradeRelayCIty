# Keys and first run

| Value | Add it here | Current state |
|---|---|---|
| `SIMULATION_MODE=true` | Local `.dev.vars` copied from `.dev.vars.example` | Ready for local simulation only |
| Cloudflare D1 ID | `wrangler.jsonc` | Replace placeholder after creating D1 |
| `APP_BASE_URL` | Worker variable; public origin, not a secret | Must match the login origin |
| `BETTER_AUTH_SECRET` | `npx wrangler secret put BETTER_AUTH_SECRET` | Generate privately before deployment |
| Groq API key (`GROQ_API_KEY`) | Create at [Groq API Keys](https://console.groq.com/keys); store as a Worker secret with `npx wrangler secret put GROQ_API_KEY` | Needed only when the real provider route is connected |
| Gemini API key (`GEMINI_API_KEY`) | Create at [Google AI Studio](https://aistudio.google.com/api-keys); store as a Worker secret with `npx wrangler secret put GEMINI_API_KEY` | Needed for Gemini fallback or direct Gemini selection |
| AI provider | Worker variable `AI_PROVIDER=groq` | Groq is the selected provider |
| AI model | Worker variable `AI_MODEL=openai/gpt-oss-20b` or `AI_MODEL=qwen/qwen3.8-27b` | GPT OSS 20B is the adapter default; Qwen 3.8 27B is a preview model |
| AI fallback | Worker variables `AI_FALLBACK_PROVIDER=gemini` and `AI_FALLBACK_MODEL=gemini-3.8-flash` | One Gemini attempt follows a failed Groq request |
| MT5 MCP Bearer key | Connector wizard on each Windows PC | Stored with Windows Credential Manager |
| Device credential | Connector's Credential Manager | Will be issued by pairing, not manually pasted |

The website owner username is `iluvpistachioos`. Set the password through `./scripts/bootstrap-owner-password.ps1` after local migrations, or add `-Remote` after remote migrations. The password does not belong in `.dev.vars`, a Vite variable, chat, or source control.

For a fresh local setup, run `./scripts/setup.ps1`, then `./scripts/bootstrap-owner-password.ps1`, then `npm run dev`. The dashboard runs synthetic fixtures without any AI or broker keys. The front end never reads provider secrets.

When real provider routing is implemented, set `GROQ_API_KEY` and `GEMINI_API_KEY` privately in local `.dev.vars` or as deployed Worker secrets. Never put them in `VITE_*` variables or commit them. Set `AI_FALLBACK_PROVIDER=gemini` to try Gemini once if Groq errors, times out, or returns an invalid response. A valid Groq HOLD and an explicit provider refusal do not trigger fallback. If both providers fail, the request fails closed. The response identifies which provider answered. To use Gemini as the primary provider instead, set `AI_PROVIDER=gemini`, `AI_MODEL=gemini-3.8-flash`, and remove `AI_FALLBACK_PROVIDER`. The `openai/` prefix in Groq's GPT OSS model ID names the model; requests use Groq's API and your Groq key.

The current simulation endpoint still uses a deterministic HOLD response and does not call either external adapter. Real provider routing must include authentication, quota reservation, and cost handling before these variables affect API decisions.
