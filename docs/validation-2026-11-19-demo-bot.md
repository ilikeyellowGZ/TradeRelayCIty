# Demo bot validation — 19 November 2026

Implemented a local, session-armed EURUSD DEMO bot in the Windows connector. The bot uses the closed-bar strategy, an owner/device/account-bound AI opinion route, broker-derived risk and margin checks, a protective stop, a single submission journal, and broker-history reconciliation. The Worker records AI opinions in migration 0013. Live-account entries remain disabled.

## Verified locally

- `npm test -- --run`: 101 TypeScript tests passed, including bound demo opinion, stale snapshot, revoked device, and D1 decision persistence.
- `connector/.venv/Scripts/python.exe -m unittest discover -s connector/tests -q` with `PYTHONPATH=connector`: 51 Python tests passed, including an unarmed cycle, one armed fake-broker submission, duplicate prevention, risk denial, unknown outcome, and stop verification.
- `npm run build`: completed. Local D1 migration 0013 applied successfully.
- PyInstaller produced a 25,482,690-byte Windows executable below the 25 MiB asset limit. The packaged download SHA-256 matched the built executable. The packaged app launched with both DEMO arming controls off and the key masked.
- A real connected FxPro DEMO terminal exposed the required MCP tools and 120 closed M15 and H1 bars. A real unarmed bot cycle, repeated after deployment, returned `HOLD` because no fully confirmed strategy setup existed. No broker order was called.
- A hypothetical EURUSD calculation through the real terminal returned `tick_size=0`, `profit=0`, and `margin=0`; `trade_check_market_order` returned `trading is not permitted`. The bot blocks on these values.
- Staging D1 migration 0013 applied. The Worker and Windows download were deployed to `https://traderelaycity.service-heyywebb.workers.dev` (version `1bbb6d4e-ea8c-4dc4-bcc2-a4ecb711236b`). A deployment smoke check confirmed the TradeRelayCity landing page, `/api/health` in `BROKER_READ_ONLY` mode, `401` from the unsigned demo opinion route, the download URL returning `200` with `application/octet-stream`, and no pending staging migrations.
- Staging has `GROQ_API_KEY` and `GEMINI_API_KEY` secrets present; their values and an authenticated AI opinion were not inspected in this validation.
- The initial deployment used the stale root `dist` asset directory and returned HTML at the download URL. The asset binding now points to `dist/client`; the second deployment passed the smoke checks above. The local packaged executable and `dist/client` copy have the same SHA-256: `1b401418918460e22885e46fa4d03a56d81c96ae7be5ccc78d2fd3a84f65c574`.

## Not yet verified

No MT5 demo order, fill, broker stop, or broker reconciliation was observed. The broker terminal must permit MCP trading and provide nonzero, account-currency contract/risk calculations before an armed order can pass. The release remains unarmed by default; website trade history still does not import broker fills. A remote byte-for-byte EXE download check was blocked by the command policy; the published URL, MIME type, local build hash, and deployed asset list were checked.

## Follow-up armed demo check

- MT5's connected account still identifies as a writable DEMO account, and the MCP server reports trading capability. In **Tools > Options > AI Assistant**, Trading is set to **Manual confirmation**. The toolbar shows **Algo Trading** off. The Windows computer-use skill prohibits changing application security or permission settings, so these controls were inspected but not changed.
- An explicitly armed local bot cycle returned `HOLD` with `no fully confirmed sweep, displacement and FVG candidate`. It did not submit an order.
- A separate non-submitting EURUSD broker probe returned `tick_size=0`, a positive one-lot loss estimate in ZAR, and `margin=0`. `trade_check_market_order` returned `Tool 'trade_check_market_order' trading is not permitted`. The current terminal still cannot pass the bot's trade guards.
- Broker reads after the test found zero open positions, zero open orders, and zero EURUSD orders or deals for the current UTC day. A real broker fill remains unverified.

## After the MT5 Trading setting was saved

- MT5 accepted a non-submitting EURUSD order check: `ok=true`, nested `result.retcode=0`, and positive projected margin. The separate `trade_order_calc_margin` MCP tool continued to return zero for 0.01, 0.1, and 1.0 lots, and Market Watch reported `tick_size=0`. The connector now parses the nested check response and uses its positive margin with a positive broker profit estimate and symbol point for sizing when those separate fields are zero. The final actual-volume order check remains required.
- The connected demo account had four open USDJPY positions. MT5's current MCP position objects use `position_id`, `action`, and `price_last`; the connector now normalizes those fields. A read-only sizing probe then correctly blocked with `Existing broker positions require manual review before a demo entry`. No new order was submitted.
- MT5's MCP order history uses `order_id` on orders and deals. Reconciliation now matches those IDs without counting unrelated deals. The MCP open-position response does not expose stop-loss or take-profit fields, so a broker-side protective stop cannot yet be confirmed from this response; a fill would remain `UNKNOWN` until verified by a suitable broker read. This is a material limit for unattended execution.
- The updated Windows executable was rebuilt (25,483,706 bytes; SHA-256 `c9cc8f248361e2b7eea303f4c06f4f008e283e593d24fe0fee53962be6affb88`) and deployed to the staged site as Worker version `62baeb41-04a5-433a-87a2-abf442f4bb02`. Build, 51 Python tests, 101 TypeScript tests, health, and download URL checks passed. One armed local cycle returned `HOLD` for no complete strategy setup; no broker order or fill was observed.
