# Trade History Implementation Plan

> **For agentic workers:** Execute each task in order. This plan is executed inline in this session.

**Goal:** Add a read-only, account-scoped, SIMULATED trade history experience with reconciled outcome fixtures, cost breakdowns, evidence-based explanations, filters, details, and CSV export.

**Architecture:** Add a versioned simulation history read model and read-only account-scoped Worker endpoints. Keep pure outcome calculation, classification, explanation, validation, and CSV safety logic in focused modules; render the feature in a new React component mounted by the existing Trade History navigation destination. Seed stable fixtures for trades and attempted entries. Real broker ingestion, production account auth, AI analysis, learning, and trading actions remain outside this feature.

**Tech Stack:** React 19, TypeScript, Vite, Hono, Cloudflare Workers, D1/SQLite, Vitest, CSS, Lucide.

**Spec:** `docs/superpowers/specs/2026-11-07-trade-history-design.md`

## Global Constraints

- Use the existing React/Vite + Hono Worker + D1 stack and current TradeRelayCity `DESIGN.md` tokens and components.
- Every fixture and UI response is labeled `SIMULATED`; do not imply connected broker history or live execution.
- Scope list, detail, and export queries to both selected account and current fixture owner; foreign/missing accounts return not found.
- Preserve source evidence immutably; corrections require a new outcome version and audit reference.
- Keep executed trades and attempted/blocked entries distinct; negative P&L alone never means strategy error.
- Use a documented break-even tolerance `abs(net P&L) <= 0.01` in account currency.
- Use parameterized D1 queries, indexed account/date/ID lookups, bounded pagination/export, UTC timestamps, and formula-safe CSV.
- Do not edit `TradeRelayCity_Codex_Build_Prompt.md`; do not add broker import, AI analysis, learning behavior, production auth, or live trading.

---

### Task 1: Outcome contract and deterministic history logic

**Files:**
- Create: `apps/worker/src/history/model.ts`
- Create: `apps/worker/src/history/model.test.ts`
- Create: `apps/worker/src/history/csv.ts`
- Create: `apps/worker/src/history/csv.test.ts`

**Interfaces:**
- `TradeOutcomeV1` describes one account-owned immutable version: `id`, `version`, `accountId`, `ownerId`, `environment`, `source`, `recordType`, `symbol`, `side`, `orderType`, `volume`, UTC `entryTime`/`exitTime`, nullable `averageEntryPrice`/`averageExitPrice`, `currency`, `grossPnl`, `commission`, `swap`, `otherCosts`, `netPnl`, `status`, `outcome`, `exitReason`, nullable strategy/prompt versions, nullable command/decision IDs, tickets, fills, timeline, explanation facts/observations/hypotheses, and data-availability flags.
- Export `classifyOutcome(record)` which returns the stored outcome/status category; closed outcomes use the 0.01 tolerance and costs are not subtracted again from an inclusive net field.
- Export `buildExplanation(record)` returning confirmed facts, supported observations, hypotheses, missing evidence, and a conservative default loss explanation.
- Export `sanitizeCsvCell(value)` and `serializeHistoryCsv(rows)` with formula neutralization for `=`, `+`, `-`, `@`, tab, and carriage-return prefixes.

- [ ] **Step 1: Add failing pure-logic tests** for profit/loss/break-even/open, rejection vs unknown vs HOLD, gross/cost/net mapping, missing context language, and CSV formula cells.
- [ ] **Step 2: Run focused tests and confirm they fail** with `npm test -- --run apps/worker/src/history/model.test.ts apps/worker/src/history/csv.test.ts`.
- [ ] **Step 3: Implement the shared types and pure functions** with no D1 or UI dependencies.
- [ ] **Step 4: Re-run focused tests and confirm they pass.**

### Task 2: D1 history tables, fixtures, and scoped API

**Files:**
- Create: `migrations/0005_trade_history.sql`
- Create: `apps/worker/src/history/repository.ts`
- Create: `apps/worker/src/history/routes.ts`
- Modify: `apps/worker/src/index.ts`
- Create: `apps/worker/src/history/repository.test.ts`
- Modify: `docs/api-contract.md`

**Interfaces:**
- `GET /api/simulation/accounts/:id/trade-history` accepts `view`, `cursor`, `limit`, `from`, `to`, `symbol`, `direction`, `strategy`, `environment`, `status`, `outcome`, and `q`; returns `{ account, items, nextCursor, pageSize }`.
- `GET /api/simulation/accounts/:id/trade-history/:outcomeId` returns one account-scoped outcome and its details; foreign/missing account/outcome returns the same 404.
- `GET /api/simulation/accounts/:id/trade-history/export.csv` accepts the same filters, exports at most 1000 matching rows, and returns `text/csv` with a safe attachment filename.
- `listHistory(db, ownerId, accountId, filters)` binds every filter and owner/account ID, orders by `created_at DESC, id DESC`, fetches at most `limit + 1`, and produces an opaque tuple cursor.
- Migration creates versioned outcome rows and deal/fill and timeline evidence rows with unique stable IDs, account and owner foreign keys, owner/account consistency checks, and indexes on `(account_id, occurred_at, id)` and lookup ticket IDs. Seed at least ten deterministic fixtures for the owner persona and representative attempts for the other fixture personas.

- [ ] **Step 1: Add repository tests** for bounded limit/cursor behavior, all specified filters, stable fixture IDs, duplicate migration seeding, and owner/account scoping.
- [ ] **Step 2: Add the migration and fixtures** for profitable close, stop-loss loss, manual loss, gross profit erased by costs, rejection, risk block, expired order, partial fill, manual import with missing rationale, and unknown submission.
- [ ] **Step 3: Implement parameterized repository queries and Hono route handlers**; call the route registration from `apps/worker/src/index.ts` under existing simulation middleware.
- [ ] **Step 4: Apply local D1 migration and run focused API/repository tests.** Verify one foreign persona receives the same 404 for list, detail, and export.
- [ ] **Step 5: Document the three read endpoints** in `docs/api-contract.md`.

### Task 3: Trade History interface and interaction

**Files:**
- Create: `src/features/trade-history/TradeHistoryPage.tsx`
- Create: `src/features/trade-history/TradeHistoryDetail.tsx`
- Create: `src/features/trade-history/trade-history.css`
- Create: `src/features/trade-history/types.ts`
- Modify: `src/App.tsx`
- Modify: `src/index.css`
- Modify: `DESIGN.md` only if a reusable primitive, token, or component state must be added.

**Interfaces:**
- `TradeHistoryPage` receives `{ accountId: string; userId: string; accountLabel: string; currency: string }` and owns view/filter/page/detail/loading/error state.
- The page uses the account-scoped list/detail/export endpoints and never calls AI or order APIs.
- `TradeHistoryDetail` receives a `TradeOutcomeV1` and `onClose`; it renders all available evidence and explicit unavailable states, with timeline and diagnostics collapsed accessibly.

- [ ] **Step 1: Add the desktop page structure** using current page heading, account label, visible SIMULATED badge, UTC/browser timezone note, two tabs, filter controls, metrics separated by currency, and semantic table.
- [ ] **Step 2: Add interactions** for filters/search, bounded newest-first pagination, detail drawer, close/Escape behavior, and filtered CSV download.
- [ ] **Step 3: Add the detail view** with outcome/cost summary, tickets/fills, chronology, price/stop/target fields, explanation evidence levels, unavailable chart state, diagnostics, and no-lessons explanation.
- [ ] **Step 4: Mount `TradeHistoryPage`** for the existing Trade History navigation item and retain `SectionPreview` for unrelated destinations.
- [ ] **Step 5: Add responsive/accessibility styles** for keyboard focus, 44px controls, mobile stacked filters, horizontally scrollable table, drawer reflow, and reduced motion, using existing design tokens.

### Task 4: Focused verification and feature handover

**Files:**
- Create: `docs/features/trade-history-handover.md`
- Modify: `docs/api-contract.md`
- Modify: `docs/progress.md`

- [ ] **Step 1: Run focused Worker tests and full TypeScript/build checks** using `npm test -- --run`, `npm run build`, and local D1 migrations.
- [ ] **Step 2: Run local HTTP smoke checks** for owner list/detail/CSV, foreign account 404 for all three, selected filters, and no-AI/no-connector offline state.
- [ ] **Step 3: Inspect the feature at 375px and desktop width** using a real browser when available; exercise filters, detail open/close, timezone label, export download, and keyboard navigation. Fix observed issues before reporting.
- [ ] **Step 4: Write the handover** with owned files, schema tables/indexes, exported types/routes, how future broker reconciliation supplies immutable versions, checks actually run, and blockers for real history import/auth/AI/learning.
- [ ] **Step 5: Update progress/API docs** and confirm the build does not stage secrets or create broker side effects.

## Plan self-review

- **Coverage:** Outcome types, categories, costs, immutable versions, fixture breadth, account isolation, list/detail/export, filters, UTC, detail evidence, conservative explanations, lessons placeholder, CSV safety, bounded access, offline operation, responsive UI, tests, and handover map to Tasks 1–4. Real broker import, production auth, AI analysis, and learning are explicitly deferred by the spec.
- **Placeholders:** No TBD/TODO steps. Every task names files, interfaces, concrete operations, and commands.
- **Type consistency:** Repository and UI both consume the shared `TradeOutcomeV1`; list/detail/export route paths are consistent across Tasks 2–3.
