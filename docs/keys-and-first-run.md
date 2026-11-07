# Keys and first run

| Value | Add it here | Current state |
|---|---|---|
| `SIMULATION_MODE=true` | Local `.dev.vars` copied from `.dev.vars.example` | Ready for local simulation only |
| Cloudflare D1 ID | `wrangler.jsonc` | Replace placeholder after creating D1 |
| `APP_BASE_URL` | Worker variable; public origin, not a secret | Needed for passkeys |
| `BETTER_AUTH_SECRET` | `npx wrangler secret put BETTER_AUTH_SECRET` | Generate privately before deployment |
| Provider key | `npx wrangler secret put OPENAI_API_KEY` (or selected provider) | Add only after implementation and provider selection |
| AI model | Worker variable `AI_MODEL` | Must be a supported, explicitly selected model |
| MT5 MCP Bearer key | Connector wizard on each Windows PC | Stored with Windows Credential Manager |
| Device credential | Connector's Credential Manager | Will be issued by pairing, not manually pasted |

For now, copy `.dev.vars.example` to `.dev.vars`, apply local migrations, and run `npm run dev`. The dashboard runs synthetic fixtures without any AI or broker keys. The front end never reads provider secrets.
