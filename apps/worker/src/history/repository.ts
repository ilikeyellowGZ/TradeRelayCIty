import { classifyOutcome, resolveNetPnl, type TradeFill, type TradeOutcomeV1, type TradeOutcomeKind } from './model'

export type HistoryFilters = {
  view?: 'executed' | 'attempts'
  cursor?: string
  limit?: number
  from?: string
  to?: string
  symbol?: string
  direction?: 'BUY' | 'SELL'
  strategy?: string
  environment?: 'SIMULATED' | 'DEMO' | 'LIVE'
  status?: string
  outcome?: TradeOutcomeKind
  q?: string
}

export type HistoryRow = Record<string, unknown> & {
  id: string; version: number; entryTime: string | null; createdAt: string; fillsJson: string; timelineJson: string
  factsJson: string; observationsJson: string; hypothesesJson: string; missingEvidenceJson: string
}

export type HistoryDatabase = Pick<D1Database, 'prepare'>

const outcomes: TradeOutcomeKind[] = ['closed_profit', 'closed_loss', 'closed_break_even', 'open_partial', 'broker_rejected', 'risk_blocked', 'skipped_hold', 'order_cancelled', 'order_expired', 'submission_unknown']
const statuses = new Set(['closed', 'open', 'partially_closed', 'rejected', 'blocked', 'skipped', 'cancelled', 'expired', 'unknown'])
function isDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function decodeCursor(cursor: string) {
  if (cursor.length > 512) return null
  try {
    const value = JSON.parse(atob(cursor)) as { time?: unknown; id?: unknown }
    return typeof value.time === 'string' && typeof value.id === 'string' && value.id.length <= 100 ? value : null
  } catch { return null }
}

function encodeCursor(time: string, id: string) { return btoa(JSON.stringify({ time, id })) }
function escapeLike(value: string) { return value.replace(/[\\%_]/g, '\\$&') }
export function boundedPageSize(value?: number) { return Math.max(1, Math.min(50, Math.trunc(value ?? 25) || 25)) }

export function buildHistoryQuery(ownerId: string, accountId: string, filters: HistoryFilters, cursor: { time: string; id: string } | null = null) {
  const clauses = ['account_id = ?', 'owner_id = ?', 'environment = ?']
  const bindings: unknown[] = [accountId, ownerId, filters.environment ?? 'SIMULATED']
  if (filters.view) { clauses.push('record_type = ?'); bindings.push(filters.view === 'executed' ? 'trade' : 'attempt') }
  if (filters.from && isDateOnly(filters.from)) { clauses.push('entry_time >= ?'); bindings.push(`${filters.from}T00:00:00.000Z`) }
  if (filters.to && isDateOnly(filters.to)) { clauses.push('entry_time < ?'); const d = new Date(`${filters.to}T00:00:00.000Z`); d.setUTCDate(d.getUTCDate() + 1); bindings.push(d.toISOString()) }
  if (filters.symbol && /^[A-Za-z0-9._-]{1,20}$/.test(filters.symbol)) { clauses.push('symbol = ?'); bindings.push(filters.symbol.toUpperCase()) }
  if (filters.direction) { clauses.push('side = ?'); bindings.push(filters.direction) }
  if (filters.strategy && filters.strategy.length <= 100) { clauses.push('strategy = ?'); bindings.push(filters.strategy) }
  if (filters.status && statuses.has(filters.status)) { clauses.push('status = ?'); bindings.push(filters.status) }
  if (filters.outcome && outcomes.includes(filters.outcome)) { clauses.push('outcome = ?'); bindings.push(filters.outcome) }
  if (filters.q && filters.q.length <= 100) {
    const query = `%${escapeLike(filters.q)}%`
    clauses.push('(id LIKE ? ESCAPE \'\\\' OR broker_ticket LIKE ? ESCAPE \'\\\')')
    bindings.push(query, query)
  }
  if (cursor) { clauses.push('(COALESCE(entry_time, created_at) < ? OR (COALESCE(entry_time, created_at) = ? AND id < ?))'); bindings.push(cursor.time, cursor.time, cursor.id) }
  return { where: clauses.join(' AND '), bindings }
}

function parseArray<T>(raw: unknown): T[] {
  if (typeof raw !== 'string' || raw.length > 100_000) return []
  try { const parsed = JSON.parse(raw) as unknown; return Array.isArray(parsed) ? parsed as T[] : [] } catch { return [] }
}

function parseFills(raw: unknown, entrySide: unknown): TradeFill[] {
  const values = parseArray<(Omit<TradeFill, 'role'> & { role?: TradeFill['role'] })>(raw)
  return values.map((fill) => ({ ...fill, role: fill.role ?? (fill.side === entrySide ? 'entry' : 'exit') }))
}

const selectFields = `id, version, account_id AS accountId, owner_id AS ownerId, environment, source, record_type AS recordType,
  symbol, side, order_type AS orderType, volume, entry_time AS entryTime, exit_time AS exitTime,
  average_entry_price AS averageEntryPrice, average_exit_price AS averageExitPrice, currency, gross_pnl AS grossPnl,
  commission, swap, other_costs AS otherCosts, net_pnl AS netPnl, status, outcome, exit_reason AS exitReason,
  strategy, strategy_version AS strategyVersion, prompt_version AS promptVersion, command_id AS commandId,
  decision_id AS decisionId, broker_ticket AS orderTicket, NULL AS positionTicket, original_stop AS originalStop, target,
  requested_price AS requestedPrice, slippage, fills_json AS fillsJson, timeline_json AS timelineJson,
  facts_json AS factsJson, observations_json AS observationsJson, hypotheses_json AS hypothesesJson,
  missing_evidence_json AS missingEvidenceJson, created_at AS createdAt`

function mapRow(row: HistoryRow): TradeOutcomeV1 {
  const recordType = row.recordType as TradeOutcomeV1['recordType']
  const status = String(row.status)
  const grossPnl = typeof row.grossPnl === 'number' ? row.grossPnl : null
  const commission = typeof row.commission === 'number' ? row.commission : null
  const swap = typeof row.swap === 'number' ? row.swap : null
  const otherCosts = typeof row.otherCosts === 'number' ? row.otherCosts : null
  const netPnl = resolveNetPnl({ brokerNet: typeof row.netPnl === 'number' ? row.netPnl : null, grossPnl, commission, swap, otherCosts })
  const outcome = classifyOutcome({ recordType, status, outcome: row.outcome as TradeOutcomeKind, exitTime: row.exitTime as string | null, netPnl })
  return {
    id: row.id, version: row.version, accountId: String(row.accountId), ownerId: String(row.ownerId), environment: row.environment as TradeOutcomeV1['environment'],
    source: row.source as TradeOutcomeV1['source'], recordType, symbol: String(row.symbol),
    side: row.side as TradeOutcomeV1['side'], orderType: row.orderType === null ? null : String(row.orderType), volume: row.volume === null ? null : Number(row.volume),
    entryTime: row.entryTime, exitTime: row.exitTime as string | null, averageEntryPrice: row.averageEntryPrice === null ? null : Number(row.averageEntryPrice),
    averageExitPrice: row.averageExitPrice === null ? null : Number(row.averageExitPrice), currency: String(row.currency),
    grossPnl, commission, swap, otherCosts, netPnl, status, outcome,
    exitReason: row.exitReason === null ? null : String(row.exitReason), strategy: row.strategy === null ? null : String(row.strategy),
    strategyVersion: row.strategyVersion === null ? null : String(row.strategyVersion), promptVersion: row.promptVersion === null ? null : String(row.promptVersion),
    commandId: row.commandId === null ? null : String(row.commandId), decisionId: row.decisionId === null ? null : String(row.decisionId),
    orderTicket: row.orderTicket === null ? null : String(row.orderTicket), positionTicket: row.positionTicket === null ? null : String(row.positionTicket),
    fills: parseFills(row.fillsJson, row.side), timeline: parseArray(row.timelineJson),
    facts: parseArray(row.factsJson), observations: parseArray(row.observationsJson), hypotheses: parseArray(row.hypothesesJson),
    missingEvidence: parseArray(row.missingEvidenceJson), originalStop: row.originalStop === null ? null : Number(row.originalStop),
    target: row.target === null ? null : Number(row.target), requestedPrice: row.requestedPrice === null ? null : Number(row.requestedPrice),
    slippage: row.slippage === null ? null : Number(row.slippage), createdAt: row.createdAt,
  }
}

export async function getHistoryAccount(db: HistoryDatabase, ownerId: string, accountId: string) {
  return db.prepare('SELECT id, label, currency, mode, environment FROM sim_accounts WHERE id = ? AND owner_id = ?').bind(accountId, ownerId).first<{ id: string; label: string; currency: string; mode: string; environment: string }>()
}

export async function listHistory(db: HistoryDatabase, ownerId: string, accountId: string, filters: HistoryFilters) {
  const pageSize = boundedPageSize(filters.limit)
  const cursor = filters.cursor ? decodeCursor(filters.cursor) : null
  if (filters.cursor && !cursor) throw new Error('Invalid history cursor')
  const query = buildHistoryQuery(ownerId, accountId, filters, cursor)
  const result = await db.prepare(`SELECT ${selectFields} FROM sim_trade_history WHERE ${query.where} ORDER BY COALESCE(entry_time, created_at) DESC, id DESC LIMIT ?`).bind(...query.bindings, pageSize + 1).all<HistoryRow>()
  const hasMore = result.results.length > pageSize
  const rows = result.results.slice(0, pageSize).map(mapRow)
  const last = rows.at(-1)
  const nextCursor = hasMore && last ? encodeCursor(last.entryTime ?? last.createdAt ?? '', last.id) : null
  return { items: rows, nextCursor, pageSize }
}

export async function getHistoryOutcome(db: HistoryDatabase, ownerId: string, accountId: string, id: string) {
  const row = await db.prepare(`SELECT ${selectFields} FROM sim_trade_history WHERE account_id = ? AND owner_id = ? AND id = ? ORDER BY version DESC LIMIT 1`)
    .bind(accountId, ownerId, id).first<HistoryRow>()
  return row ? mapRow(row) : null
}

export async function getHistoryExportRows(db: HistoryDatabase, ownerId: string, accountId: string, filters: HistoryFilters) {
  const query = buildHistoryQuery(ownerId, accountId, filters)
  const result = await db.prepare(`SELECT ${selectFields} FROM sim_trade_history WHERE ${query.where} ORDER BY COALESCE(entry_time, created_at) DESC, id DESC LIMIT 1000`)
    .bind(...query.bindings).all<HistoryRow>()
  return result.results.map(mapRow)
}
