import { useEffect, type ReactNode } from 'react'
import { AlertTriangle, Clock3, FileText, ShieldCheck, X } from 'lucide-react'
import { aggregateFills, buildExplanation, redactSensitiveText, type TradeOutcomeV1 } from '../../../apps/worker/src/history/model'

const precision: Record<string, number> = { EURUSD: 5, GBPUSD: 5, AUDUSD: 5, USDJPY: 3, BTCUSD: 2 }

function price(value: number | null, symbol: string) {
  return value === null ? 'Unavailable' : value.toFixed(precision[symbol] ?? 5)
}

function money(value: number | null, currency: string) {
  return value === null ? 'Unavailable' : new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value)
}

function dateTime(value: string | null, timezone: string) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium', timeZone: timezone }).format(new Date(value)) : 'Not recorded'
}

function DetailsRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="th-detail-row"><dt>{label}</dt><dd>{children}</dd></div>
}

export function TradeHistoryDetail({ trade, onClose }: { trade: TradeOutcomeV1; onClose: () => void }) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const explanation = buildExplanation(trade)
  const fillSummary = aggregateFills(trade.fills)
  const recordedActions = trade.timeline.filter((item) => /stop|target|modify|intervention|protect|connection|disconnect|manual/i.test(`${item.label} ${item.detail}`))

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = previous }
  }, [onClose])

  return <div className="th-drawer-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <aside className="th-drawer" role="dialog" aria-modal="true" aria-labelledby="th-detail-title">
      <header className="th-drawer-header">
        <div><span className="th-eyebrow">TRADE RECORD · VERSION {trade.version}</span><h2 id="th-detail-title">{trade.symbol} {trade.side ? `· ${trade.side}` : ''}</h2></div>
        <button type="button" className="th-icon-button" onClick={onClose} aria-label="Close trade details"><X size={19} /></button>
      </header>
      <div className="th-drawer-content">
        <section className="th-outcome-banner">
          <span className={`th-outcome-mark th-outcome-mark--${trade.netPnl === null ? 'neutral' : trade.netPnl > 0 ? 'positive' : trade.netPnl < 0 ? 'negative' : 'neutral'}`} aria-hidden="true" />
          <div><strong>{trade.exitReason ? redactSensitiveText(trade.exitReason) : trade.status.replaceAll('_', ' ')}</strong><span>{trade.source} · {trade.environment} · {trade.recordType === 'trade' ? 'Executed trade' : 'Attempted entry'}</span></div>
          <b className={trade.netPnl === null ? '' : trade.netPnl >= 0 ? 'th-positive' : 'th-negative'}>{money(trade.netPnl, trade.currency)}</b>
        </section>

        <section className="th-detail-section" aria-labelledby="th-summary-heading">
          <h3 id="th-summary-heading">Outcome summary</h3>
          <dl className="th-detail-grid">
            <DetailsRow label="Status">{trade.status.replaceAll('_', ' ')}</DetailsRow>
            <DetailsRow label="Outcome">{trade.outcome.replaceAll('_', ' ')}</DetailsRow>
            <DetailsRow label="Order type">{trade.orderType ?? 'Unavailable'}</DetailsRow>
            <DetailsRow label="Filled volume">{trade.volume === null ? 'Unavailable' : `${trade.volume.toFixed(2)} lots`}</DetailsRow>
            <DetailsRow label="Entry time">{dateTime(trade.entryTime, timezone)}</DetailsRow>
            <DetailsRow label="Exit time">{dateTime(trade.exitTime, timezone)}</DetailsRow>
            <DetailsRow label="Average entry">{price(trade.averageEntryPrice, trade.symbol)}</DetailsRow>
            <DetailsRow label="Average exit">{price(trade.averageExitPrice, trade.symbol)}</DetailsRow>
            <DetailsRow label="Timezone">{timezone} (source timestamps stored in UTC)</DetailsRow>
            <DetailsRow label="Strategy">{trade.strategy ?? 'Original strategy unavailable'}</DetailsRow>
            <DetailsRow label="Strategy / prompt">{trade.strategyVersion ?? 'No saved version'} / {trade.promptVersion ?? 'No saved version'}</DetailsRow>
          </dl>
        </section>

        <section className="th-detail-section" aria-labelledby="th-pnl-heading">
          <h3 id="th-pnl-heading">Profit and costs <span>{trade.currency}</span></h3>
          <dl className="th-money-list">
            <DetailsRow label="Gross P&L">{money(trade.grossPnl, trade.currency)}</DetailsRow>
            <DetailsRow label="Commission">{money(trade.commission, trade.currency)}</DetailsRow>
            <DetailsRow label="Swap">{money(trade.swap, trade.currency)}</DetailsRow>
            <DetailsRow label="Other charges">{money(trade.otherCosts, trade.currency)}</DetailsRow>
            <DetailsRow label="Net P&L"><strong className={trade.netPnl === null ? '' : trade.netPnl >= 0 ? 'th-positive' : 'th-negative'}>{money(trade.netPnl, trade.currency)}</strong></DetailsRow>
          </dl>
          <p className="th-footnote">Net is the recorded broker-style outcome. Listed charges are not subtracted a second time.</p>
        </section>

        <section className="th-detail-section" aria-labelledby="th-execution-heading">
          <h3 id="th-execution-heading">Execution evidence</h3>
          <dl className="th-detail-grid">
            <DetailsRow label="Internal ID">{trade.id}</DetailsRow>
            <DetailsRow label="Order ticket">{trade.orderTicket ? redactSensitiveText(trade.orderTicket) : 'Not recorded'}</DetailsRow>
            <DetailsRow label="Position ticket">{trade.positionTicket ? redactSensitiveText(trade.positionTicket) : 'Not recorded'}</DetailsRow>
            <DetailsRow label="Command / decision">{trade.commandId ?? '—'} / {trade.decisionId ?? '—'}</DetailsRow>
            <DetailsRow label="Requested price">{price(trade.requestedPrice, trade.symbol)}</DetailsRow>
            <DetailsRow label="Average fill price">{price(trade.averageEntryPrice, trade.symbol)}</DetailsRow>
            <DetailsRow label="Measured slippage">{trade.slippage === null ? 'Unavailable' : price(trade.slippage, trade.symbol)}</DetailsRow>
            <DetailsRow label="Original stop / target">{price(trade.originalStop, trade.symbol)} / {price(trade.target, trade.symbol)}</DetailsRow>
            <DetailsRow label="Chart">Price history is not attached to this fixture, so no chart is available.</DetailsRow>
          </dl>
          {trade.fills.length > 0 && <div className="th-fill-list"><h4>Deals and partial fills</h4><p className="th-footnote">Deal aggregation: {fillSummary.entryVolume.toFixed(2)} lots entered, {fillSummary.closedVolume.toFixed(2)} lots closed · weighted entry {price(fillSummary.averageEntryPrice, trade.symbol)} · weighted exit {price(fillSummary.averageExitPrice, trade.symbol)}.</p>{trade.fills.map((fill) => <article key={fill.id}>
            <div><strong>{fill.role} · {fill.side} · {fill.volume.toFixed(2)} lots</strong><span>{dateTime(fill.occurredAt, timezone)}</span></div>
            <div><span>Deal ticket: {fill.ticket ? redactSensitiveText(fill.ticket) : fill.id}</span><strong>{price(fill.price, trade.symbol)}</strong></div>
            <span>Gross {money(fill.grossPnl, trade.currency)} · commission {money(fill.commission, trade.currency)} · swap {money(fill.swap, trade.currency)}</span>
          </article>)}</div>}
        </section>

        <section className="th-detail-section" aria-labelledby="th-why-heading">
          <h3 id="th-why-heading">Why did this outcome happen?</h3>
          {explanation.defaultLossExplanation && <p className="th-neutral-note">{explanation.defaultLossExplanation}</p>}
          {trade.outcome === 'closed_loss' && <p className="th-footnote">A loss does not, by itself, show that a recorded rule was broken.</p>}
          <div className="th-explanation-level"><h4><ShieldCheck size={16} /> Confirmed facts</h4>{explanation.confirmedFacts.length ? explanation.confirmedFacts.map((item) => <article key={item.id}><strong>{redactSensitiveText(item.label)}</strong><p>{redactSensitiveText(item.detail)}</p><code>Evidence: {item.id}</code></article>) : <p>No confirmed cause is present in the saved records.</p>}</div>
          <div className="th-explanation-level"><h4><FileText size={16} /> Supported observations</h4>{explanation.supportedObservations.length ? explanation.supportedObservations.map((item) => <article key={item.id}><strong>{redactSensitiveText(item.label)}</strong><p>{redactSensitiveText(item.detail)}</p><code>Evidence: {item.id}</code></article>) : <p>No supported observations were saved.</p>}</div>
          <div className="th-explanation-level"><h4><AlertTriangle size={16} /> Possible factors · hypotheses</h4>{explanation.hypotheses.length ? explanation.hypotheses.map((item) => <article key={item.id}><strong>{redactSensitiveText(item.label)}</strong><p>{redactSensitiveText(item.detail)}</p><p className="th-hypothesis">{item.uncertainty}</p><code>Evidence: {item.id}</code></article>) : <p>No hypotheses are recorded.</p>}</div>
          {trade.missingEvidence.length > 0 && <div className="th-missing-evidence"><strong>Evidence not available</strong><ul>{trade.missingEvidence.map((item) => <li key={item}>{redactSensitiveText(item)}</li>)}</ul></div>}
        </section>

        <section className="th-detail-section" aria-labelledby="th-timeline-heading">
          <h3 id="th-timeline-heading"><Clock3 size={17} /> Timeline</h3>
          {trade.timeline.length ? <ol className="th-timeline">{trade.timeline.map((item) => <li key={item.id}><time dateTime={item.occurredAt}>{dateTime(item.occurredAt, timezone)}</time><strong>{redactSensitiveText(item.label)}</strong><p>{redactSensitiveText(item.detail)}</p>{item.evidenceId && <code>Record: {item.evidenceId}</code>}</li>)}</ol> : <p>No timeline records are attached.</p>}
        </section>

        <section className="th-detail-section" aria-labelledby="th-actions-heading">
          <h3 id="th-actions-heading">Stop, target, and protective actions</h3>
          {recordedActions.length ? <ul className="th-action-list">{recordedActions.map((item) => <li key={item.id}><strong>{redactSensitiveText(item.label)}</strong><span>{redactSensitiveText(item.detail)}</span></li>)}</ul> : <p>No stop/target modifications, manual interventions, protective actions, or connection interruptions were recorded for this fixture.</p>}
        </section>

        <section className="th-detail-section th-lessons" aria-labelledby="th-lessons-heading">
          <h3 id="th-lessons-heading">Lessons and changes</h3>
          <p>No lessons or future decision changes are linked. The learning feature is not connected.</p>
        </section>

        <details className="th-diagnostics"><summary>Technical diagnostics</summary><dl><DetailsRow label="Correlation / outcome ID">{trade.id}</DetailsRow><DetailsRow label="Command ID">{trade.commandId ?? 'Not available'}</DetailsRow><DetailsRow label="Source version">{trade.version}</DetailsRow><DetailsRow label="Raw diagnostics">No unredacted broker message is stored in this fixture.</DetailsRow></dl></details>
      </div>
    </aside>
  </div>
}
