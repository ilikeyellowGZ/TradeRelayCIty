import { Hono } from 'hono'
import { serializeHistoryCsv } from './csv'
import { getHistoryAccount, getHistoryExportRows, getHistoryOutcome, listHistory, type HistoryDatabase, type HistoryFilters } from './repository'

type HistoryEnv = { Bindings: { DB: D1Database }; Variables: { simulationUser: string } }

function isDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function filtersFromQuery(query: Record<string, string | undefined>): HistoryFilters {
  const filters: HistoryFilters = {}
  if (query.view === 'executed' || query.view === 'attempts') filters.view = query.view
  if (query.cursor) filters.cursor = query.cursor
  if (query.limit && /^\d{1,3}$/.test(query.limit)) filters.limit = Number(query.limit)
  if (query.from && isDateOnly(query.from)) filters.from = query.from
  if (query.to && isDateOnly(query.to)) filters.to = query.to
  if (query.symbol && /^[A-Za-z0-9._-]{1,20}$/.test(query.symbol)) filters.symbol = query.symbol
  if (query.direction === 'BUY' || query.direction === 'SELL') filters.direction = query.direction
  if (query.strategy && query.strategy.length <= 100) filters.strategy = query.strategy
  if (query.environment === 'SIMULATED') filters.environment = query.environment
  if (query.status && query.status.length <= 40) filters.status = query.status
  if (query.outcome && query.outcome.length <= 40) filters.outcome = query.outcome as HistoryFilters['outcome']
  if (query.q && query.q.length <= 100) filters.q = query.q
  return filters
}

export function registerHistoryRoutes(app: Hono<HistoryEnv>) {
  app.get('/api/simulation/accounts/:id/trade-history', async (c) => {
    const accountId = c.req.param('id')
    const db = c.env.DB as HistoryDatabase
    const account = await getHistoryAccount(db, c.get('simulationUser'), accountId)
    if (!account) return c.json({ error: 'Account not found' }, 404)
    const filters = filtersFromQuery(c.req.query())
    try {
      const page = await listHistory(db, c.get('simulationUser'), accountId, filters)
      return c.json({ account: { id: account.id, label: account.label, currency: account.currency, environment: account.environment, mode: account.mode }, ...page, mode: 'SIMULATED', isLive: false }, 200, { 'cache-control': 'no-store' })
    } catch {
      return c.json({ error: 'Invalid history cursor or query.' }, 400)
    }
  })

  app.get('/api/simulation/accounts/:id/trade-history/export.csv', async (c) => {
    const accountId = c.req.param('id')
    const db = c.env.DB as HistoryDatabase
    const account = await getHistoryAccount(db, c.get('simulationUser'), accountId)
    if (!account) return c.json({ error: 'Account not found' }, 404)
    const filters = filtersFromQuery(c.req.query())
    const rows = await getHistoryExportRows(db, c.get('simulationUser'), accountId, filters)
    const csv = serializeHistoryCsv(rows as unknown as Record<string, unknown>[])
    return new Response(csv, { headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="trade-history-${account.id}.csv"`,
      'cache-control': 'no-store',
    } })
  })

  app.get('/api/simulation/accounts/:id/trade-history/:outcomeId', async (c) => {
    const accountId = c.req.param('id')
    const outcomeId = c.req.param('outcomeId')
    if (outcomeId.length > 100) return c.json({ error: 'Trade history record not found' }, 404)
    const db = c.env.DB as HistoryDatabase
    const account = await getHistoryAccount(db, c.get('simulationUser'), accountId)
    if (!account) return c.json({ error: 'Trade history record not found' }, 404)
    const outcome = await getHistoryOutcome(db, c.get('simulationUser'), accountId, outcomeId)
    if (!outcome) return c.json({ error: 'Trade history record not found' }, 404)
    return c.json({ outcome, mode: 'SIMULATED', isLive: false }, 200, { 'cache-control': 'no-store' })
  })
}
