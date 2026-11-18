# Optional broker question classifier

The **MT5 snapshots** assistant can use a server-side OpenAI, Anthropic, or xAI model to classify a question. The model receives the text the user types and the open-position symbol names only. It returns one validated intent and, for a position question, an exact symbol from that list. TradeRelayCity then renders the answer from the persisted owner-bound MT5 snapshot. Stored account numbers, login, broker identity, and position prices are never added to the classifier request; a user could still type sensitive details into their own question. The model receives no MT5 or trading tools and cannot place orders.

Without a configured provider, the deterministic snapshot answer path remains available. Even with a provider, questions about daily or historical results, market analysis, backtests, risk calculations, predictions, and trading actions are declined before the provider call. The model can still misclassify an ambiguous question; the UI labels provider classification and the source timestamp. It cannot generate account values in the answer.

## Configuration

Set the following **Worker-side** variables for one provider:

| Variable | Value |
|---|---|
| `BROKER_AI_PROVIDER` | `openai`, `anthropic`, or `xai` |
| `BROKER_AI_MODEL` | A model supported by that provider's structured output API |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `XAI_API_KEY` | The matching secret key; set only the selected provider's key |

There is no default model or enabled provider. Keep keys in ignored local Worker secrets for development or Cloudflare Worker secrets for hosting; never use `VITE_` variables, source files, browser storage, or connector settings. Apply migration `0012_broker_ai_usage.sql` before enabling the endpoint. The owner can inspect availability via `GET /api/broker/ai-capabilities`; this response does not reveal the key.

The endpoint permits at most 30 owner requests per UTC day, reserving a request before the provider call. It caps output at 256 tokens, provider response body at 8 KiB, and call time at 12 seconds. Failed provider calls count toward the daily cap to bound spend. No provider credentials are configured in this repository, so live provider calls, chosen model compatibility, and billing remain unverified.

The adapters use the providers' current documented structured-output endpoints: [OpenAI Responses](https://developers.openai.com/api/reference/resources/responses/methods/create), [Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create), and [xAI Responses](https://docs.x.ai/developers/rest-api-reference/inference/responses). Check the selected model's support and current pricing before setting a key.
