import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Activity, ChevronLeft, ChevronRight, Download, Search, SlidersHorizontal, X } from 'lucide-react'
import { buildExplanation, redactSensitiveText, type TradeOutcomeKind, type TradeOutcomeV1 } from '../../../apps/worker/src/history/model'
import { TradeHistoryDetail } from './TradeHistoryDetail'
import type { HistoryPageResponse } from './types'
import './trade-history.css'

type View = 'executed' | 'attempts'
type FilterValues = { from: string; to: string; symbol: string; direction: string; strategy: string; environment: string; status: string; outcome: string; q: string }
const emptyFilters: FilterValues = { from: '', to: '', symbol: '', direction: '', strategy: '', environment: 'SIMULATED', status: '', outcome: '', q: '' }
const outcomeOptions: [TradeOutcomeKind, string][] = [
  ['closed_profit', 'Closed with profit'], ['closed_loss', 'Closed with loss'], ['closed_break_even', 'Near break-even'], ['open_partial', 'Open or partially closed'],
  ['broker_rejected', 'Broker rejected'], ['risk_blocked', 'Risk blocked'], ['skipped_hold', 'Skipped / HOLD'], ['order_cancelled', 'Cancelled'], ['order_expired', 'Expired'], ['submission_unknown', 'Awaiting reconciliation'],
]
const statusOptions = ['closed', 'open', 'partially_closed', 'rejected', 'blocked', 'skipped', 'cancelled', 'expired', 'unknown']
const strategies = ['London continuation', 'Range fade', 'Gold pullback', 'New York reversal', 'Breakout continuation', 'Imported manual trade', 'Fixture strategy']
const precision: Record<string, number> = { EURUSD: 5, GBPUSD: 5, USDJPY: 3, XAUUSD: 2 }

function money(value: number | null, currency: string) {
  return value === null ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value)
}

function price(value: number | null, symbol: string) { return value === null ? '—' : value.toFixed(precision[symbol] ?? 5) }
function dateTime(value: string | null, timezone: string) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(value)) : '—' }
function titleCase(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function costs(item: TradeOutcomeV1) {
  if (item.commission === null && item.swap === null && item.otherCosts === null) return '—'
  return money((item.commission ?? 0) + (item.swap ?? 0) + (item.otherCosts ?? 0), item.currency)
}

function OutcomeBadge({ item }: { item: TradeOutcomeV1 }) {
  const explanation = buildExplanation(item)
  const reason = item.exitReason ? redactSensitiveText(item.exitReason) : explanation.confirmedFacts[0]?.detail ?? (item.outcome === 'closed_loss' ? explanation.defaultLossExplanation : null) ?? 'No cause is established by the saved records.'
  return <span className={`th-outcome-badge th-outcome-badge--${item.outcome}`} title={reason}>{titleCase(item.outcome)}</span>
}

export function TradeHistoryPage({ accountId, userId, accountLabel, currency }: { accountId: string; userId: string; accountLabel: string; currency: string }) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const [view, setView] = useState<View>('executed')
  const [draft, setDraft] = useState<FilterValues>(emptyFilters)
  const [filters, setFilters] = useState<FilterValues>(emptyFilters)
  const [cursor, setCursor] = useState<string | null>(null)
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([])
  const [page, setPage] = useState<HistoryPageResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [exportBusy, setExportBusy] = useState(false)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<TradeOutcomeV1 | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const [detailError, setDetailError] = useState('')

  const filterQuery = useMemo(() => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
    return params.toString()
  }, [filters])

  const loadHistory = useCallback(async (signal?: AbortSignal) => {
    if (!accountId) { setLoading(false); setError('The selected simulated account is not available.'); return }
    setLoading(true)
    try {
      const params = new URLSearchParams(filterQuery)
      params.set('view', view)
      params.set('limit', '25')
      if (cursor) params.set('cursor', cursor)
      const response = await fetch(`/api/simulation/accounts/${encodeURIComponent(accountId)}/trade-history?${params}`, { headers: { 'x-simulation-user': userId }, signal })
      if (!response.ok) throw new Error(response.status === 404 ? 'History is not available for this simulated account.' : 'Trade history could not be loaded.')
      const result = await response.json() as HistoryPageResponse
      setPage(result)
      setError('')
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setError(reason instanceof Error ? reason.message : 'Trade history is unavailable while the local simulation API is offline.')
      setPage(null)
    } finally { if (!signal?.aborted) setLoading(false) }
  }, [accountId, cursor, filterQuery, userId, view])

  useEffect(() => {
    const controller = new AbortController()
    void loadHistory(controller.signal)
    return () => controller.abort()
  }, [loadHistory])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCursor(null)
    setCursorStack([])
    setFilters(draft)
  }

  function clearFilters() {
    setDraft(emptyFilters)
    setFilters(emptyFilters)
    setCursor(null)
    setCursorStack([])
  }

  function changeView(next: View) {
    setView(next)
    setCursor(null)
    setCursorStack([])
    setDetail(null)
  }

  async function openDetail(id: string) {
    setDetail(null)
    setDetailError('')
    setDetailBusy(true)
    try {
      const response = await fetch(`/api/simulation/accounts/${encodeURIComponent(accountId)}/trade-history/${encodeURIComponent(id)}`, { headers: { 'x-simulation-user': userId } })
      if (!response.ok) throw new Error('This history record is not available for the selected account.')
      const result = await response.json() as { outcome: TradeOutcomeV1 }
      setDetail(result.outcome)
    } catch (reason) { setDetailError(reason instanceof Error ? reason.message : 'Trade details could not be loaded.') }
    finally { setDetailBusy(false) }
  }

  async function exportCsv() {
    setExportBusy(true)
    try {
      const params = new URLSearchParams(filterQuery)
      params.set('view', view)
      const response = await fetch(`/api/simulation/accounts/${encodeURIComponent(accountId)}/trade-history/export.csv?${params}`, { headers: { 'x-simulation-user': userId } })
      if (!response.ok) throw new Error('CSV export could not be created for this account.')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `trade-history-${accountId}-${view}.csv`
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'CSV export is unavailable.') }
    finally { setExportBusy(false) }
  }

  const items = page?.items ?? []
  const records = items.length
  const totals = items.reduce((result, item) => {
    if (item.currency === currency && item.recordType === 'trade' && item.exitTime !== null) {
      result.gross += item.grossPnl ?? 0
      result.costs += (item.commission ?? 0) + (item.swap ?? 0) + (item.otherCosts ?? 0)
      result.net += item.netPnl ?? 0
    }
    return result
  }, { gross: 0, costs: 0, net: 0 })

  return <section className="th-page" aria-labelledby="th-page-title">
    <div className="page-intro page-intro--simple th-page-intro">
      <div><div className="overline"><span className="overline-line" />ACCOUNT RECORDS</div><h1 id="th-page-title">Trade History<span className="title-period">.</span></h1><p className="page-subtitle">Outcomes, costs, and recorded reasons for each attempt.</p></div>
      <div className="th-account-stamp"><strong>{accountLabel || 'Selected account'}</strong><span>SIMULATED · LIVE OFF</span></div>
    </div>

    <div className="th-preview-banner" role="note"><Activity size={17} /><p><strong>Local simulation records.</strong> These are labeled fixtures, not imported broker history. No orders are placed by this page.</p></div>

    <div className="th-toolbar">
      <div className="th-tabs" role="tablist" aria-label="History record type">
        <button type="button" role="tab" aria-selected={view === 'executed'} className={view === 'executed' ? 'is-selected' : ''} onClick={() => changeView('executed')}>Executed trades</button>
        <button type="button" role="tab" aria-selected={view === 'attempts'} className={view === 'attempts' ? 'is-selected' : ''} onClick={() => changeView('attempts')}>Attempts / blocks</button>
      </div>
      <button type="button" className="th-export-button" onClick={() => void exportCsv()} disabled={!accountId || exportBusy || loading} aria-label="Export account scoped CSV"><Download size={16} />{exportBusy ? 'Preparing…' : 'Export CSV'}</button>
    </div>

    <form className="th-filter-panel" aria-label="Trade history filters" onSubmit={applyFilters}>
      <div className="th-filter-heading"><span><SlidersHorizontal size={16} />Filters</span><button type="button" className="th-clear-button" onClick={clearFilters}><X size={14} />Clear</button></div>
      <div className="th-filter-grid">
        <label>Search ticket or trade ID<span className="th-search-input"><Search size={15} /><input value={draft.q} onChange={(event) => setDraft({ ...draft, q: event.target.value })} placeholder="e.g. SIM-TKT-1001" maxLength={100} /></span></label>
        <label>From<input type="date" value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} /></label>
        <label>To<input type="date" value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })} /></label>
        <label>Symbol<input value={draft.symbol} onChange={(event) => setDraft({ ...draft, symbol: event.target.value.toUpperCase().slice(0, 20) })} placeholder="All symbols" /></label>
        <label>Direction<select value={draft.direction} onChange={(event) => setDraft({ ...draft, direction: event.target.value })}><option value="">All</option><option value="BUY">Buy</option><option value="SELL">Sell</option></select></label>
        <label>Strategy<select value={draft.strategy} onChange={(event) => setDraft({ ...draft, strategy: event.target.value })}><option value="">All strategies</option>{strategies.map((strategy) => <option key={strategy}>{strategy}</option>)}</select></label>
        <label>Environment<select value={draft.environment} onChange={(event) => setDraft({ ...draft, environment: event.target.value })}><option value="SIMULATED">SIMULATED</option></select></label>
        <label>Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option value="">All statuses</option>{statusOptions.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></label>
        <label>Outcome<select value={draft.outcome} onChange={(event) => setDraft({ ...draft, outcome: event.target.value })}><option value="">All outcomes</option>{outcomeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="th-filter-actions"><span>Times stored in UTC · filtered by UTC dates</span><button type="submit">Apply filters</button></div>
      </div>
    </form>

    <div className="th-list-meta"><span>{records} record{records === 1 ? '' : 's'} on this page · {timezone} <small>(source timestamps stored in UTC)</small></span><span className="th-currency-label">Totals shown in {currency} for visible closed trades</span></div>
    {error && <div className="th-error-banner" role="alert">{error}</div>}
    {detailError && <div className="th-error-banner" role="alert">{detailError}</div>}
    {detailBusy && <p className="th-loading" role="status">Loading trade evidence…</p>}

    {view === 'executed' && <div className="th-summary-grid" aria-label="Visible page totals">
      <article><span>Gross P&L · visible page</span><strong>{money(totals.gross, currency)}</strong></article>
      <article><span>Recorded charges · visible page</span><strong>{money(totals.costs, currency)}</strong></article>
      <article><span>Net P&L · visible page</span><strong className={totals.net >= 0 ? 'th-positive' : 'th-negative'}>{money(totals.net, currency)}</strong></article>
    </div>}

    <section className="panel th-list-panel" aria-label={view === 'executed' ? 'Executed trades' : 'Attempted and blocked entries'}>
      <div className="th-table-scroll" role="region" aria-label="Trade history table" tabIndex={0}>
        <table className="th-history-table">
          <thead><tr><th scope="col">Instrument</th><th scope="col">Side / volume</th><th scope="col">Entry / exit</th><th scope="col">Gross / costs</th><th scope="col" className="align-right">Net P&L</th><th scope="col">Outcome</th><th scope="col">Source / reason</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={7}><span className="th-loading" role="status">Loading account history…</span></td></tr>}
            {!loading && items.map((item) => <tr key={`${item.id}:${item.version}`}>
              <td><button type="button" className="th-row-open" onClick={() => void openDetail(item.id)} aria-label={`Open details for ${item.symbol}, ${item.id}`}><strong>{item.symbol}</strong><small>{item.orderType ?? 'Entry attempt'} · {item.id}</small></button></td>
              <td><span className={`side-badge ${item.side ? `side-badge--${item.side.toLowerCase()}` : ''}`}>{item.side ?? '—'}</span><small className="th-cell-sub">{item.volume === null ? 'No fill recorded' : `${item.volume.toFixed(2)} lots`}</small></td>
              <td><strong>{dateTime(item.entryTime, timezone)}</strong><small className="th-cell-sub">{price(item.averageEntryPrice, item.symbol)} → {price(item.averageExitPrice, item.symbol)}{item.exitTime ? ` · ${dateTime(item.exitTime, timezone)}` : ' · no exit recorded'}</small></td>
              <td><strong>{money(item.grossPnl, item.currency)}</strong><small className="th-cell-sub">Fees {costs(item)}</small></td>
              <td className={`align-right ${item.netPnl === null ? '' : item.netPnl >= 0 ? 'th-positive' : 'th-negative'}`}>{money(item.netPnl, item.currency)}</td>
              <td><OutcomeBadge item={item} /></td>
              <td><strong>{item.source}</strong><small className="th-cell-sub">{item.exitReason ? redactSensitiveText(item.exitReason) : 'The saved records do not establish a cause.'}</small></td>
            </tr>)}
            {!loading && !items.length && !error && <tr><td colSpan={7}><div className="th-empty"><Activity size={23} /><strong>No matching {view === 'executed' ? 'trades' : 'attempts'} found</strong><span>Try changing filters. The selected account has no records for this view.</span></div></td></tr>}
          </tbody>
        </table>
      </div>
      <footer className="th-pagination"><span>{page?.nextCursor ? 'More history available' : 'End of available simulated history'}</span><div>
        <button type="button" className="th-page-button" onClick={() => { const previous = [...cursorStack]; const previousCursor = previous.pop() ?? null; setCursorStack(previous); setCursor(previousCursor) }} disabled={!cursorStack.length || loading}><ChevronLeft size={16} />Previous</button>
        <button type="button" className="th-page-button" onClick={() => { if (page?.nextCursor) { setCursorStack([...cursorStack, cursor]); setCursor(page.nextCursor) } }} disabled={!page?.nextCursor || loading}>Next<ChevronRight size={16} /></button>
      </div></footer>
    </section>

    <p className="th-tolerance-note">Near break-even uses |net P&amp;L| ≤ 0.01 {currency}. Recorded charges are informational when net is already inclusive of costs. Mixed currencies are never combined; page totals include only {currency}.</p>
    {detail && <TradeHistoryDetail trade={detail} onClose={() => setDetail(null)} />}
  </section>
}
