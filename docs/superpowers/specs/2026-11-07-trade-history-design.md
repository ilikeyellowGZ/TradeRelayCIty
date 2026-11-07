# Trade History — Design Specification

Date: 2026-11-07
Status: Approved; implementation in progress

## Goal

Add a useful Trade History destination to the existing TradeRelayCity dashboard so a user can inspect simulated trade outcomes and attempted entries, understand recorded reasons and costs, and distinguish facts from uncertain explanations. This feature must remain usable without the learning feature, chatbot, AI keys, or a broker connection.

## Repository constraints

- The app is React, TypeScript, Vite, Hono, Cloudflare Workers, and D1. Keep this stack and the existing dashboard shell, navigation, brand tokens, and responsive patterns.
- Current D1 data includes simulated accounts, positions, commands, decisions, and events. It does not include reconciled trade outcomes, deal-level fills, fee corrections, or broker history imports.
- The connector is currently read-only setup/discovery and does not import MT5 history. No production broker account binding or execution is implemented.
- The only working data path for this feature is the local, loopback-only simulation API selected by fixture persona. All example data must be labeled SIMULATED and must never imply real broker activity.
- Reuse the existing account-owner filtering and same-404 behavior for foreign or absent account records. Do not edit `TradeRelayCity_Codex_Build_Prompt.md`.

## Recommended approach

Add an account-scoped, versioned history read model and read-only simulation API, then render it in the existing Trade History destination. The read model represents reconciled outcomes and links to existing command/decision evidence where available; it is not an order, deal, or position ledger and must not become a competing broker source of truth. Import/reconciliation integration is explicitly deferred until the connector and broker binding exist.

Expose a typed `TradeOutcomeV1`-style contract from the Worker read adapter. It should include stable outcome and source references, account and environment, source label, symbol and direction, order type and filled volume, UTC entry/exit timestamps, weighted average fill prices where applicable, account currency, gross P&L, separately reported commission/swap/other costs, net P&L, lifecycle/outcome classification, and linked evidence IDs. Unsupported values remain null/unavailable rather than being inferred. Any later correction is represented by a new outcome version with an audit link; source history stays immutable.

## Outcome classification and calculations

Keep executed trades and attempted/blocked entries in distinct views. Supported outcome states include closed net profit, closed net loss, closed near break-even, open/partially closed, broker rejected, risk/authorization/data blocked, skipped/HOLD, pending order cancelled/expired, and submission unknown/awaiting reconciliation. Losing P&L alone never implies a strategy error. Unknown submission remains unresolved, not a confirmed rejection.

Use a documented break-even tolerance of `abs(net P&L) <= 0.01` in account currency for the simulation fixtures. Report gross P&L, each available charge, and net P&L as gross less the reported charges, once. When the broker-style `net` field is already inclusive of a cost, do not subtract that cost again. Keep currencies separate; do not create cross-currency aggregates without a dated conversion basis. Sample instrument precision is defined per fixture symbol and shown consistently in list and detail views.

## History interface

- Keep the active account and SIMULATED environment visible. Display timestamps as UTC and identify the selected/browser timezone when converting them.
- Provide separate Executed Trades and Attempts/Blocks views. The history list includes symbol, side, order type, filled volume, entry/exit times, average entry/exit prices, net P&L, currency, status, source, and a short factual exit/rejection reason.
- Provide account, date range, symbol, direction, strategy, environment, status, and outcome filters, plus ticket/internal ID search. Use newest-first bounded pagination.
- Add account-scoped CSV export. Escape formula-leading cells and exclude secrets/raw credentials.
- Selecting a row opens a detail drawer/page with the factual outcome, order/deal tickets and partial fills, rationale and saved strategy/prompt version, stop/target changes, chronology, costs and net P&L, requested/actual execution and slippage when available, recorded interventions/interruptions, and evidence references. Show imported/manual source and absent original context plainly.
- Only show an entry/stop/target/exit chart if suitable price data exists; otherwise show an explicit unavailable state.
- Place low-level diagnostics in a collapsed section and redact sensitive broker text. Escape untrusted broker/AI text in rendered content.
- Reserve a lessons section. Since no learning feature exists, state that no lessons or adjustments are linked.

## Explanations

Present three distinct levels: confirmed facts, supported observations, and possible contributing factors marked as hypotheses with evidence and uncertainty. Every statement cites the linked command, decision, check, deal, or snapshot record when available. When the saved records do not establish a cause, use: “The available records do not establish why this setup lost.” Explain missing context; never infer news, liquidity events, bad timing, or strategy mistakes from negative P&L alone.

The initial implementation is deterministic and does not require AI. An Analyze outcome action is deferred because real AI routing is not wired to authorized saved outcome records. The interface must not show fabricated AI analysis or spend AI quota on render.

## Example data

Provide clearly labeled fixtures covering: profitable close; stop-loss loss; manual losing close; gross profit erased by costs; broker rejection; risk-blocked entry; expired order; partial fill; imported manual trade with missing strategy context; and unknown submission. All simulation fixtures are marked SIMULATED and use dates/times and IDs that are stable enough for local review. Fixtures must link to existing decision/command evidence where that evidence exists and explicitly mark missing evidence otherwise.

## Data access and safety

- All history list, detail, export, and artifact reads are scoped to the selected account and current simulation persona in SQL. Foreign and missing accounts return the same not-found response.
- Use parameterized D1 statements, indexes for account/time and lookup identifiers, bounded page sizes, and no full-table scan per refresh.
- CSV fields that begin with spreadsheet formula characters are neutralized.
- History is read-only; it cannot submit or alter orders, change strategy settings, or overwrite source records.
- The local simulation route remains guarded by its existing loopback and `SIMULATION_MODE` checks. Do not claim production auth or broker access is complete.

## Verification plan

Focused implementation checks should cover account isolation for list/detail/export, version and duplicate-import idempotency, the documented P&L mapping and partial-fill aggregation, outcome classification, unknown submission, explanation behavior with absent context, CSV formula neutralization, and bounded pagination. UI verification should exercise both views, filters, detail content, timezone labeling, offline/no-AI states, and narrow layouts. Report only checks actually run; real broker history, production auth, and paid AI behavior remain unverified external integrations.

## Deliverables

- Migration(s) and account-scoped read adapter/API, if needed by the repository's current model.
- Typed history data contract and labeled simulation fixtures.
- Trade History page/view, distinct executed and attempts sections, details, filtering, and CSV export.
- `docs/features/trade-history-handover.md` documenting files, schema, exports, integration steps, checks, and remaining blockers.
- Focused tests for feature logic and ownership behavior.

## Scope boundary

Do not implement real MT5/FxPro history import, reconciliation, production account ownership/auth routes, optional admin inspection, paid AI analysis, learning behavior, or live trading. Define integration points for future broker reconciliation to provide immutable, versioned outcome records through the shared read contract.
