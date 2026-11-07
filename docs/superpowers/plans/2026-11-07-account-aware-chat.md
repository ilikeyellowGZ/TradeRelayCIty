# Account-Aware Assistant Implementation Plan

> **For agentic workers:** Inline execution follows this plan. Steps use checkbox syntax for tracking.

**Goal:** Add account-scoped simulated conversations grounded in TradeRelayCity's existing simulation records.

**Architecture:** A loopback-only simulation API stores account-owned conversations and serves deterministic, cited answers from bounded D1 reads. A responsive dashboard page calls those endpoints and clearly labels every assistant response as simulated.

**Tech Stack:** React, TypeScript, Hono, Cloudflare D1, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-07-account-aware-chat-design.md`

## Global Constraints

- Reuse the current React/Vite, Hono Worker, D1, auth/simulation and design-system foundations.
- Keep the AI/provider key server-side; this simulation feature makes no provider call.
- Never trust model-produced identity or account IDs; enforce account ownership in SQL.
- Do not claim access to unreconciled history, learning, or broker execution.
- No chat actions or trading commands.

---

### Task 1: Persist scoped simulated conversations

**Files:** Create `migrations/0005_account_chat.sql`; modify `apps/worker/src/index.ts`; create `apps/worker/src/chat/simulation.ts` and focused `apps/worker/src/chat/simulation.test.ts`.

- [x] Add conversation/message/usage tables with cascading message deletion and account/user indexes.
- [x] Add bounded, parameterized API endpoints for listing, creating, deleting conversations and posting messages.
- [x] Derive user from validated simulation middleware and verify account ownership before reads/writes.
- [x] Enforce separate daily chat quotas, message caps, explicit citations, deterministic responses, and honest missing-history replies.
- [x] Cover isolation, grounding, injection inertness, bounds, quota, and deletion.

### Task 2: Add the Assistant destination

**Files:** Create `src/components/AssistantPage.tsx`; modify `src/App.tsx` and `src/index.css`.

- [x] Replace the empty Assistant destination with a responsive, keyboard-usable conversation surface.
- [x] Preserve selected account and SIMULATED mode labels; provide starter prompts and record citations.
- [x] Support list/new/delete/history, pending/error/offline states, and AbortController cancellation.
- [x] Keep UI copy explicit about unavailable completed-trade and learning records.

### Task 3: Handover and verification

**Files:** Create `docs/features/chatbot-handover.md`; modify `docs/api-contract.md` and `README.md`.

- [x] Document owned files, migration, types, routes, data providers, and future history/learning/command integration.
- [x] Run focused tests, full `npm test`, and `npm run build`; report outcomes and unverified integrations honestly.
