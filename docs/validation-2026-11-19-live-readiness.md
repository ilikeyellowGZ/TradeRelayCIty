# Live trading readiness — 19 November 2026

## Current result

Live-account order entry is **disabled**. The connector can authenticate an MT5 MCP key, read a DEMO or LIVE account, and upload a read-only snapshot to the paired website device. The website binds a device to the exact broker, server, login, environment, and currency; switching accounts requires re-pairing. The connector now rejects a snapshot receipt if the account mode or observation time differs from what it sent. The Trading page identifies paired LIVE accounts separately and does not offer a live order action.

The local terminal was not running for this check. No real DEMO fill, protective stop verification, broker reconciliation, or LIVE-account order validation has been completed. No live order was submitted.

Local verification: 59 Python connector tests and 108 website tests passed; the production website and Windows connector builds passed. A simulated LIVE account check showed the connector's read-only mode and disabled live-order message. A GUI test confirmed LIVE mode clears DEMO arming and disables its bot controls. React Doctor reported no new findings in the changed Trading page. The packaged executable and built-site download have matching SHA-256 hashes. These checks do not establish broker execution readiness.

## Gates before an executable LIVE option

1. Complete a minimal-volume DEMO order with a broker-side stop and verify its fill, stop, and history through the connected MT5 account. Rejection, partial fill, timeout, restart, and uncertain outcome paths must also be reconciled. The current MCP open-position response does not expose stop fields, so a suitable broker read must be found and validated.
2. Add an owner- and account-scoped website command ledger, pause control, risk settings, and broker-confirmed trade history. The existing demo bot currently executes locally and its website AI/strategy routes accept DEMO accounts only.
3. Add separate website and connector LIVE opt-ins bound to the exact LIVE broker, server, login, currency, device, strategy version, and connector protocol version. A new account, key, device, or terminal identity must reset readiness and pause new entries.
4. Validate the current LIVE account's exact EURUSD contract, quote, session, margin, order-check, stop, fill, and history behavior without submitting a live order. A controlled live order test requires separate authorization and an operator-visible funded account.
5. Build and sign the Windows release, verify the hosted download hash and clean-PC setup, then enable LIVE entry only for an account that passes every gate. Keep new entries paused on any mismatch, stale observation, outage, or unresolved order.

The approved architecture and release order are in [the public-user live trading design](superpowers/specs/2026-11-19-public-users-live-trading-design.md) and [the delivery map](trading-delivery-map.md).
