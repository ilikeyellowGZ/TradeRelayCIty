# Account-Aware Assistant Handover

## Implemented scope

The new Assistant destination works against the repository's existing local simulation fixtures only. Responses are deterministic and labeled **Simulated assistant**. They do not call the configured AI decision adapters. The top bar and Assistant page keep the active account and `SIMULATED` mode visible.

The Assistant reads only the selected simulated user's records: account summary snapshots, open positions, saved commands, latest saved decision, and up to ten records through the shared `TradeOutcomeV1` history repository. History fixtures are synthetic and remain visibly simulated. It explains the absence of validated learning, broker capabilities, and live bot state. It does not expose action tools or submit, modify, cancel, or close commands. Provider payloads, credentials, filesystem, shell, and arbitrary SQL are not exposed.

## Owned files

- `migrations/0005_account_chat.sql`: namespaced fixture conversation, message, and separate daily usage tables. Messages cascade when a conversation is deleted; records expire after 90 days.
- `apps/worker/src/chat/simulation.ts`: bounded question parsing and deterministic answer/citation types, including history facts, observations, hypotheses, and missing evidence.
- `apps/worker/src/chat/simulation.test.ts`: answer grounding, missing history, loss-vs-open-position wording, rejection-vs-broker distinction, injection inertness, separate quota wording, and message bounds.
- `apps/worker/src/index.ts`: loopback-only, same-origin mutation endpoints; parameterized owner/account-scoped queries; 20 daily replies per simulation user; maximum 50 listed conversations, 100 messages each, and 2,000 characters per message.
- `src/components/AssistantPage.tsx`, `src/App.tsx`, `src/index.css`: responsive UI, conversation controls, citations, keyboard behavior, and loading/error/cancel states.
- `docs/api-contract.md`, `README.md`, `docs/superpowers/specs/2026-11-07-account-aware-chat-design.md`, `docs/superpowers/plans/2026-11-07-account-aware-chat.md`: product, API, and design integration references.

## Exported interfaces

`ChatContext`, `ChatAccount`, `ChatPosition`, `ChatCommand`, and `ChatAnswer` are exported from `apps/worker/src/chat/simulation.ts`. `answerSimulationQuestion(question, context)` is a deterministic fixture adapter. `normalizeChatQuestion(value)` accepts only trimmed strings of 1 to 2,000 characters.

## API

- `GET /api/simulation/chat?accountId=...` lists that account's unexpired conversations.
- `POST /api/simulation/chat` creates a conversation for an account the validated local persona owns.
- `GET /api/simulation/chat/:id` returns up to 100 messages.
- `DELETE /api/simulation/chat/:id` deletes the conversation and cascades its messages.
- `POST /api/simulation/chat/:id/messages` appends a question and deterministic cited response.

Every endpoint is under the existing loopback `SIMULATION_MODE=true` middleware and accepts only the three existing fixture persona IDs. Mutations require matching request origin. The persona comes from existing simulation middleware, never from the request body or assistant text. Account and conversation queries include owner predicates. Expired conversations are purged when that persona next uses the chat. Trade outcome reads go through `apps/worker/src/history/repository.ts` and remain filtered by account, owner, and `SIMULATED` environment. These endpoints are disabled in deployed/non-loopback mode and are not production session-auth routes.

## Integration steps for production features

1. **Auth/accounts:** Replace fixture persona headers with the authenticated Better Auth session user ID, then resolve an account through the production account ownership table. Preserve indistinguishable not-found behavior for missing and foreign accounts. Do not accept a user/account identity from the model.
2. **History:** Replace the current fixture `TradeOutcomeV1` source with the production reconciled ledger through the existing history repository. Do not create a second chat ledger. Include stable IDs, environment, fills, costs, net P&L, decision-time evidence and freshness. Keep the explicit no-history response when the scoped query returns no outcomes.
3. **Learning:** Add a typed adapter to the separate owner-approved learning records. Conversations and assistant opinions must not create or promote lessons.
4. **AI provider:** Extend the backend provider abstraction with a bounded chat adapter and strict response schema, provider timeouts, cancellation where supported, separate chat accounting, redacted logs, and provider data disclosure. Keep all provider credentials server-side. Stored messages and tool output remain untrusted data.
5. **Commands/actions:** Keep chat read-only by default. If action previews are introduced, route them through discovered capabilities, explicit short-lived confirmation bound to actor/account/parameters, fresh authorization/risk validation, and the shared command ledger. Do not execute from free-form model text.
6. **UI links/status:** Link cited records when the history, decision, lesson, and command detail routes exist. Continue to render raw content as escaped text and show unavailable/stale states.

## Verification and blockers

The deterministic adapter tests cover response grounding and prompt injection inertness. Run `npm run db:migrate:local` to apply migrations before local use. This feature does not prove production account isolation, Better Auth session behavior for chat, provider reliability, streaming/cancellation upstream, broker execution, live capabilities, production reconciliation, or learning integration. Those remain blocked on their respective production subsystems.
