# Costs and limits (checked 7 November 2026)

Cloudflare plan terms change; recheck the official pricing pages before launch. Three connectors polling every 15 seconds make about `3 × 86,400 / 15 = 17,280` sync requests/day before dashboard, passkey, retries, or AI calls.

Cloudflare's current published Workers Free allowance is 100,000 requests/day; free CPU is 10 ms per request by default (limits page). D1 Workers Free lists 5 million rows read/day, 100,000 rows written/day, and 5 GB total storage. Each query bills rows it reads; indexes, joins, status history, account snapshots and migrations also consume rows. Keep polling batched, select indexed account-scoped data, avoid per-tick writes, paginate history and bound local/cloud logs.

At 17,280 syncs/day, a design that performs two indexed reads and one small write per successful poll could approach roughly 34,560 read rows and 17,280 written rows/day before other traffic. This is a planning estimate, not a measured bill; actual rows read depend on query plans and result sets. A `HOLD` response should avoid creating execution rows.

AI billing is separate from Cloudflare. Mock provider usage is local and free. A real provider has its own API account, model pricing, quotas, retries and in-flight usage. No ChatGPT/Claude/Grok chat subscription implies API credits. Do not estimate dollar cost until a provider/model is selected and dated rates are recorded.

The Worker is request-driven. It cannot run a permanent polling loop. The user's Windows connector performs local scheduling and stops during sleep/offline periods. No account credentials or provider keys are in the browser.

Official sources: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/). Pricing pages checked on 2026-11-07; allowances and terms can change.
