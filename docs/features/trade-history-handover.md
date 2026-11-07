# Trade History feature handover

## Delivered

Trade History is a read-only dashboard destination for labeled local simulation history. Executed records and attempted/blocked entries are separate views. The page shows account/environment, P&L and available fees, dates in the browser timezone with UTC source labeling, source and reason, filters, bounded pagination, CSV export, and a detail drawer with fills, evidence, timeline, stop/target context, conservative explanation levels, and unavailable-data states.

All rows are synthetic `SIMULATED` fixtures. This feature does not import MT5/FxPro history, access a live/demo broker, call a paid AI service, modify source records, or submit orders.

## Files

- `migrations/0006_trade_history.sql` — versioned account-owned read model, indexes, synthetic decision/command evidence, and fixtures. Its insert seeding uses stable IDs and `INSERT OR IGNORE` for repeatability.
- `apps/worker/src/history/model.ts` — `TradeOutcomeV1`, classifications, known-cost net calculation, partial-fill aggregation, evidence explanation shaping, and secret-text redaction.
- `apps/worker/src/history/csv.ts` — fixed CSV columns, formula neutralization, text redaction, and quoting.
- `apps/worker/src/history/repository.ts` — typed D1 access, validated filters, bounded pagination/export, account scoping, and row decoding.
- `apps/worker/src/history/routes.ts` — local simulation list/detail/export routes.
- `apps/worker/src/history/*.test.ts` — pure outcome, cost, aggregation, CSV, query, and pagination tests.
- `src/features/trade-history/TradeHistoryPage.tsx` — filters, executed/attempt views, table, pagination and CSV download.
- `src/features/trade-history/TradeHistoryDetail.tsx` — outcome, fills, cost breakdown, evidence levels, chronology, unavailable states and diagnostics drawer.
- `src/features/trade-history/types.ts` — browser response types tied to the shared versioned Worker type.
- `src/features/trade-history/trade-history.css` — feature layout and responsive behavior.
- `src/App.tsx` — mounts the history page in the existing navigation destination (shared with the account-aware Assistant change).
- `DESIGN.md` — records the history table/drawer component and accessibility states.
- `docs/api-contract.md` — history API contract (shared with the account-aware Assistant change).

## Data model and P&L mapping

`sim_trade_history` stores one stable outcome ID with an integer version. Composite foreign keys bind each version to an account and its owner; indexes support account/time ordering and account-scoped ticket lookup. `supersedes_version` and `correction_reason` provide fields for future corrected outcome versions. JSON arrays store related fills, timeline entries, confirmed facts, supported observations, hypotheses, and missing evidence. The feature exposes no write endpoint, so it cannot update source history.

`sim_trade_history` is an outcome read model, not an order, deal, or broker position ledger. The simulation fixtures describe a reconciled position-level outcome with related deal/fill evidence. Future reconciliation must group orders, deals and positions according to the broker's netting/hedging rules before writing `TradeOutcomeV1`; it must not infer a position from a single ticket or combine uncertain source attribution.

If an inclusive broker net value exists, it is authoritative and costs are not subtracted again. If net is absent, the read adapter calculates it only when gross P&L, commission, swap, and other charges are all known. Otherwise net remains unavailable. Page totals include only closed records in the selected account currency. Near break-even is `abs(net P&L) <= 0.01` account-currency units.

## Exported API

All three routes are behind the existing loopback-only `SIMULATION_MODE=true` middleware and use `x-simulation-user` solely for local fixtures.

- `GET /api/simulation/accounts/{id}/trade-history` — `view`, bounded `limit` (1–50), opaque newest-first cursor, UTC date range, symbol, direction, strategy, status, outcome and ticket/internal ID search. Returns account context, `TradeOutcomeV1[]`, and a next cursor.
- `GET /api/simulation/accounts/{id}/trade-history/{outcomeId}` — latest version and its evidence arrays.
- `GET /api/simulation/accounts/{id}/trade-history/export.csv` — filtered export capped at 1,000 rows, with a fixed column allowlist, redaction, and spreadsheet formula neutralization.

Each route checks account ownership in SQL; detail additionally constrains the outcome ID by owner and account. Foreign and absent records receive the same 404 behavior. Every query is parameterized. No AI or connector request is made by rendering or exporting this page.

## Fixtures

Owner history includes a profitable close, stop-loss loss, manual losing close, gross profit erased by costs, broker rejection, risk-blocked entry, expired order, partial close with remaining volume, manual import without original strategy context, unknown submission, near-break-even close, and cancelled pending order. Morgan has a HOLD/skipped fixture; Taylor has a risk-blocked/offline fixture. These records are synthetic examples, not measured broker results.

## Integration steps for broker history

1. Add a read-only history request to the user's authorized connector, with bounded date ranges and explicit account binding. It must not submit orders.
2. Reconcile broker order/deal/position records into one owner/account-scoped `TradeOutcomeV1` version, preserving all deal tickets, partial fills, cost fields, UTC times, source labels, and evidence IDs.
3. Keep raw source evidence immutable. If the broker corrects fees, append a new version with `supersedes_version` and an audit reason rather than overwriting the prior version.
4. Replace simulation routes with authenticated production adapters only after real account ownership checks, connector access, and broker contract mappings are implemented and verified.
5. Publish an outcome-finalized event only after reconciliation has determined that the version is final; consumers such as learning or chat read through the shared adapter and do not duplicate this schema.

## Checks performed

Update this section with the final commands and browser/API checks run for the handoff. Real broker-history import, production auth, real AI analysis, and learning integration are outside the current implementation.

## Remaining blockers

- No connector history import or broker reconciliation exists; all displayed examples are SIMULATED.
- Current production auth/account ownership paths are not connected to these routes. The existing route guards intentionally reject non-local simulation use.
- Real broker net-P&L field semantics, fee corrections, hedging/netting behavior, symbol precision and timezone/broker contract mapping still require verified broker records.
- Suitable price series for entry/stop/target/exit charts are not present in the fixture history.
- Outcome analysis by AI and lessons/future adjustments remain unavailable until their separately scoped features exist.
