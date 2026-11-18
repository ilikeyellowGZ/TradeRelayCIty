# Optional assistant question classifier

The **MT5 snapshots** assistant can use a server-side OpenAI, Anthropic, xAI, Groq, or Gemini model to classify a question. The model receives the text the user types and the open-position symbol names only. It returns one validated intent and, for a position question, an exact symbol from that list. TradeRelayCity then renders the answer from the persisted owner-bound MT5 snapshot. Stored account numbers, login, broker identity, and position prices are never added to the classifier request; a user could still type sensitive details into their own question. The model receives no MT5 or trading tools and cannot place orders.

Without a configured provider, the deterministic snapshot answer path remains available. Even with a provider, questions about daily or historical results, market analysis, backtests, risk calculations, predictions, and trading actions are declined before the provider call. The model can still misclassify an ambiguous question; the UI labels provider classification and the source timestamp. It cannot generate account values in the answer.

## Configuration

Set the following **Worker-side** variables for one provider:

| Variable | Value |
|---|---|
| `BROKER_AI_PROVIDER` | `openai`, `anthropic`, `xai`, `groq`, or `gemini` |
| `BROKER_AI_MODEL` | A model supported by that provider's structured output API |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `GROQ_API_KEY`, or `GEMINI_API_KEY` | The matching Worker-side secret key |

An explicit `BROKER_AI_PROVIDER` and `BROKER_AI_MODEL` take priority. Otherwise both assistants reuse `AI_PROVIDER` and `AI_MODEL`; a matching `AI_FALLBACK_PROVIDER` / `AI_FALLBACK_MODEL` with its key enables one fallback on network failures, timeouts, HTTP 429, or HTTP 5xx. Refusals, invalid output, and invented symbols never trigger fallback. For Groq, model IDs include the namespace, for example `openai/gpt-oss-20b`. Keep keys in ignored local Worker secrets for development or Cloudflare Worker secrets for hosting; never use `VITE_` variables, source files, browser storage, or connector settings. Apply migration `0012_broker_ai_usage.sql` before enabling the broker endpoint. The owner can inspect availability via `GET /api/broker/ai-capabilities`; this response does not reveal a key.

The broker endpoint permits at most 30 owner requests per UTC day, reserving a request before the provider call. OpenAI, Anthropic, and xAI output is capped at 256 tokens; Groq and Gemini allow 1,024 tokens including reasoning. Provider response bodies are capped at 8 KiB. Each provider attempt has a 12-second timeout, or 30 seconds for Gemini. Failed provider calls count toward the daily cap. Keys are never committed.

The local simulation Assistant exposes the same optional checkbox and `GET /api/simulation/ai-capabilities`. Its existing 20-reply daily limit also bounds AI calls. The provider receives the question and fixture symbols only; deterministic fixture records supply the answer, and both messages are saved together in D1. Simulation endpoints remain restricted to loopback with `SIMULATION_MODE=true`. Hosted workspaces select the MT5 source and never call the disabled simulation endpoints.

Groq's adapter follows its [structured output contract](https://console.groq.com/docs/structured-outputs). Gemini uses its [structured output API](https://ai.google.dev/gemini-api/docs/structured-output). Live Groq classification and local D1-backed AI chat were verified on 19 November 2026; Gemini returned HTTP 503 due to high demand during verification.

The adapters use the providers' current documented structured-output endpoints: [OpenAI Responses](https://developers.openai.com/api/reference/resources/responses/methods/create), [Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create), and [xAI Responses](https://docs.x.ai/developers/rest-api-reference/inference/responses). Check the selected model's support and current pricing before setting a key.
