# Account-Aware Assistant Design

## Goal and boundary

Add a responsive Assistant page to the existing TradeRelayCity React dashboard. The first integration is explicitly local SIMULATED mode and answers only from the selected persona's existing D1 account, command, decision, and versioned `TradeOutcomeV1` history records. Learning history does not exist in the current schema; the assistant must say so rather than infer it from conversations or trades.

## Architecture

Use a namespaced simulation chat API guarded by the existing loopback-only simulation middleware. The server obtains the persona from validated request context, verifies account ownership on every account-scoped query, and never accepts model-supplied user or account identifiers. D1 stores conversations, messages, and a separate daily chat allocation. Trade outcomes come from the shared history repository; chat does not create a competing ledger. The simulation answerer is deterministic and does not call a provider; all answers carry SIMULATED provenance and cited internal IDs. No action tools are exposed.

The frontend adds a dedicated Assistant destination using the established `DESIGN.md` shell, colors, and responsive behavior. It keeps account and mode visible, supports new conversation, deletion, starter prompts, message history, loading/error/offline states, and cancellation of the active browser request. Local deterministic answers are labeled as simulated.

## Data and evidence behavior

The assistant may summarize account balance/equity/open positions, list trade outcomes and execution-attempt statuses, explain losses from recorded facts while separating observations and hypotheses, cite the latest decision rationale, and report connector state. It cannot claim that simulation records establish a real broker execution. Queries are bounded, parameterized, and account filtered. User text and stored records are treated as untrusted content; the deterministic answerer never interprets them as instructions.

Conversations are owned by one simulated user and account. Deleting a conversation deletes its messages. A separate chat allocation prevents chat usage from consuming the existing decision allocation. The simulation UI/API explicitly says provider-backed answers, real user auth, production chat, reconciled history, learning, and order actions are not integrated.

## Verification

Add focused worker tests for ownership isolation, bounded content and usage, record grounding, absent trade-history honesty, prompt injection as inert user text, and deletion. Run the project test suite and production build. Document schema, exported API shape, current behavior, and exact future adapters in `docs/features/chatbot-handover.md`.
