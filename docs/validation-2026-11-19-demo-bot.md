# Demo bot validation — 19 November 2026

Implemented a local, session-armed EURUSD DEMO bot in the Windows connector. The bot uses the closed-bar strategy, an owner/device/account-bound AI opinion route, broker-derived risk and margin checks, a protective stop, a single submission journal, and broker-history reconciliation. The Worker records AI opinions in migration 0013. Live-account entries remain disabled.

## Verified locally

- `npm test -- --run`: 76 TypeScript tests passed, including bound demo opinion, stale snapshot, revoked device, and D1 decision persistence.
- `connector/.venv/Scripts/python.exe -m unittest discover -s connector/tests -q` with `PYTHONPATH=connector`: 43 Python tests passed, including an unarmed cycle, one armed fake-broker submission, duplicate prevention, risk denial, unknown outcome, and stop verification.
- `npm run build`: completed. Local D1 migration 0013 applied successfully.
- PyInstaller produced a 25,482,690-byte Windows executable below the 25 MiB asset limit. The packaged download SHA-256 matched the built executable. The packaged app launched with both DEMO arming controls off and the key masked.
- A real connected FxPro DEMO terminal exposed the required MCP tools and 120 closed M15 and H1 bars. A real unarmed bot cycle, repeated after deployment, returned `HOLD` because no fully confirmed strategy setup existed. No broker order was called.
- A hypothetical EURUSD calculation through the real terminal returned `tick_size=0`, `profit=0`, and `margin=0`; `trade_check_market_order` returned `trading is not permitted`. The bot blocks on these values.
- Staging D1 migration 0013 applied. The Worker and Windows download were deployed to `https://traderelaycity.service-heyywebb.workers.dev` (version `1bbb6d4e-ea8c-4dc4-bcc2-a4ecb711236b`). A deployment smoke check confirmed the TradeRelayCity landing page, `/api/health` in `BROKER_READ_ONLY` mode, `401` from the unsigned demo opinion route, the download URL returning `200` with `application/octet-stream`, and no pending staging migrations.
- Staging has `GROQ_API_KEY` and `GEMINI_API_KEY` secrets present; their values and an authenticated AI opinion were not inspected in this validation.
- The initial deployment used the stale root `dist` asset directory and returned HTML at the download URL. The asset binding now points to `dist/client`; the second deployment passed the smoke checks above. The local packaged executable and `dist/client` copy have the same SHA-256: `1b401418918460e22885e46fa4d03a56d81c96ae7be5ccc78d2fd3a84f65c574`.

## Not yet verified

No MT5 demo order, fill, broker stop, or broker reconciliation was observed. The broker terminal must permit MCP trading and provide nonzero, account-currency contract/risk calculations before an armed order can pass. The release remains unarmed by default; website trade history still does not import broker fills. A remote byte-for-byte EXE download check was blocked by the command policy; the published URL, MIME type, local build hash, and deployed asset list were checked.
