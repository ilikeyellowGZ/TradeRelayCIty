# Connector Pairing and Broker Snapshots Implementation Plan

> **For agentic workers:** Implement the tasks inline in this checkout. The project owner has authorized the full connector sequence; no subagents are needed.

**Goal:** Pair a Windows connector to the authenticated owner and display bounded, account-bound MT5 balance and position snapshots over HTTPS.

**Architecture:** Better Auth guards owner browser routes. A random one-time code exchanges for a device bearer credential, whose SHA-256 digest is stored in D1. The connector reads only allowlisted MT5 MCP tools, normalizes their results, and uploads snapshots to device-authenticated Worker routes. The dashboard reads owner-scoped snapshots and labels their age.

**Tech Stack:** Hono, Better Auth, Cloudflare D1, React, Python MCP SDK, Windows Credential Manager, Vitest, unittest.

**Spec:** `docs/superpowers/specs/2026-11-18-demo-connector-pipeline-design.md`

## Global Constraints

- Keep `LIVE_ENTRY_EXECUTION_ENABLED = False` and do not call any MT5 trading tool in this plan.
- Pairing credentials and MT5 keys never enter browser storage, source files, or build assets.
- Account identity is broker + server + login; an identity change requires re-pairing.
- Stage on `traderelaycity-staging`; leave the production D1 placeholder intact.

---

### Task 1: D1 contract and validation

**Files:** Create `migrations/0009_connector_pairing.sql`, `apps/worker/src/broker/model.ts`, and `apps/worker/src/broker/model.test.ts`.

**Interfaces:** `normalizeSnapshot(input: unknown, now: Date): BrokerSnapshot` and `digestSecret(value: string): Promise<string>`.

- [ ] Write failing tests for a valid DEMO snapshot, malformed account identity, stale/future timestamp, excessive positions, and wrong-side prices.
- [ ] Run `npm test -- apps/worker/src/broker/model.test.ts` and observe the missing implementation failure.
- [ ] Implement strict bounded validation and the schema for pairing codes, rate buckets, devices, account bindings, and latest snapshots.
- [ ] Run focused tests and `npm run build`.

### Task 2: Pairing and revocation API

**Files:** Create `apps/worker/src/broker/routes.ts` and `apps/worker/src/broker/routes.test.ts`; modify `apps/worker/src/index.ts`.

**Interfaces:** `registerBrokerRoutes(app)` mounts owner routes under `/api/broker/*` and device routes under `/api/connector/*`.

- [ ] Write failing route tests for unsigned denial, foreign owner denial, origin denial, code replay/expiry, device token rejection, and revocation.
- [ ] Implement owner session checks, owner ID check, code exchange, bearer digest lookup, and account-scoped queries.
- [ ] Run focused tests, full `npm test`, and build.

### Task 3: Read-only MT5 collection and cloud client

**Files:** Create `connector/traderelaycity_connector/broker_snapshot.py`, `connector/traderelaycity_connector/cloud_client.py`; modify `connector/traderelaycity_connector/main.py` and `connector/tests/test_connector.py`.

**Interfaces:** `read_broker_snapshot(endpoint, key)` calls only account-info and open-positions tools; `CloudClient.pair(code, name)` and `CloudClient.upload_snapshot(token, snapshot)` use HTTPS.

- [ ] Write failing Python tests for tool allowlist, schema rejection, response bounds, HTTPS URL validation, and no secret persistence to files.
- [ ] Implement normalized MT5 parsing, token storage in Windows Credential Manager, and connector pairing/sync controls.
- [ ] Run `connector/.venv/Scripts/python.exe -m unittest discover -s connector/tests -v` from the project root.

### Task 4: Dashboard and staging validation

**Files:** Create `src/features/broker/BrokerPage.tsx` and CSS; modify `src/App.tsx`, `docs/windows-connector.md`, and `docs/progress.md`.

**Interfaces:** The Broker page lists devices, creates one-time codes, revokes devices, and displays account snapshots and their age.

- [ ] Implement the page with explicit loading/error/stale states and no secret display after code creation.
- [ ] Run `npm test`, `npm run build`, React Doctor, and local route smoke.
- [ ] Apply migration 0009 to staging, deploy, and verify unauthenticated and device-authenticated HTTP boundaries.
- [ ] Build and inspect the connector ZIP only after Python tests pass.

### Task 5: Demo execution follow-on

**Files:** A separate plan will cover the command ledger, risk gate, broker adapter, reconciliation, and demo terminal validation described in the spec.

- [ ] Start only after the real MT5 demo account and discovered tool schemas are available, because the official capability list does not define the tool input/output schemas.
