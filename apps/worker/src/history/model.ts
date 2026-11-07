export type TradeOutcomeKind = 'closed_profit' | 'closed_loss' | 'closed_break_even' | 'open_partial' | 'broker_rejected' | 'risk_blocked' | 'skipped_hold' | 'order_cancelled' | 'order_expired' | 'submission_unknown'
export type TradeRecordType = 'trade' | 'attempt'

export type TradeEvidence = { id: string; label: string; detail: string; occurredAt: string | null }
export type TradeFill = { id: string; ticket: string | null; occurredAt: string; side: 'BUY' | 'SELL'; role: 'entry' | 'exit' | 'adjustment'; volume: number; price: number; commission: number; swap: number; grossPnl: number; netPnl: number | null }
export type TradeTimelineItem = { id: string; occurredAt: string; label: string; detail: string; evidenceId: string | null }

export type TradeOutcomeV1 = {
  id: string
  version: number
  accountId: string
  ownerId: string
  environment: 'SIMULATED' | 'DEMO' | 'LIVE'
  source: 'TradeRelayCity' | 'Manual' | 'Other'
  recordType: TradeRecordType
  symbol: string
  side: 'BUY' | 'SELL' | null
  orderType: string | null
  volume: number | null
  entryTime: string | null
  exitTime: string | null
  averageEntryPrice: number | null
  averageExitPrice: number | null
  currency: string
  grossPnl: number | null
  commission: number | null
  swap: number | null
  otherCosts: number | null
  netPnl: number | null
  status: string
  outcome: TradeOutcomeKind
  exitReason: string | null
  strategy: string | null
  strategyVersion: string | null
  promptVersion: string | null
  commandId: string | null
  decisionId: string | null
  brokerTicket: string | null
  fills: TradeFill[]
  timeline: TradeTimelineItem[]
  facts: TradeEvidence[]
  observations: TradeEvidence[]
  hypotheses: TradeEvidence[]
  missingEvidence: string[]
  originalStop: number | null
  target: number | null
  requestedPrice: number | null
  slippage: number | null
  createdAt?: string
}

export type TradeOutcomeFilter = TradeOutcomeKind | 'all'

export function classifyOutcome(record: Pick<TradeOutcomeV1, 'recordType' | 'status' | 'outcome' | 'exitTime' | 'netPnl'>): TradeOutcomeKind {
  if (record.recordType === 'attempt') return record.outcome
  if (!record.exitTime || record.status === 'open' || record.status === 'partially_closed') return 'open_partial'
  if (record.netPnl === null || !Number.isFinite(record.netPnl)) return 'submission_unknown'
  if (Math.abs(record.netPnl) <= 0.01) return 'closed_break_even'
  return record.netPnl > 0 ? 'closed_profit' : 'closed_loss'
}

export function netFromComponents(grossPnl: number, costs: { commission: number; swap: number; otherCosts: number }) {
  return grossPnl - costs.commission - costs.swap - costs.otherCosts
}

export function resolveNetPnl(record: { brokerNet: number | null; grossPnl: number | null; commission: number | null; swap: number | null; otherCosts: number | null }) {
  if (record.brokerNet !== null) return record.brokerNet
  if (record.grossPnl === null || record.commission === null || record.swap === null || record.otherCosts === null) return null
  return netFromComponents(record.grossPnl, { commission: record.commission, swap: record.swap, otherCosts: record.otherCosts })
}

export function aggregateFills(fills: TradeFill[]) {
  const entryFills = fills.filter((fill) => fill.role === 'entry')
  const exitFills = fills.filter((fill) => fill.role === 'exit')
  const weightedPrice = (rows: TradeFill[]) => {
    const volume = rows.reduce((sum, fill) => sum + fill.volume, 0)
    return volume ? rows.reduce((sum, fill) => sum + fill.price * fill.volume, 0) / volume : null
  }
  return {
    entryVolume: entryFills.reduce((sum, fill) => sum + fill.volume, 0),
    closedVolume: exitFills.reduce((sum, fill) => sum + fill.volume, 0),
    averageEntryPrice: weightedPrice(entryFills),
    averageExitPrice: weightedPrice(exitFills),
    grossPnl: exitFills.reduce((sum, fill) => sum + fill.grossPnl, 0),
    commission: fills.reduce((sum, fill) => sum + fill.commission, 0),
    swap: fills.reduce((sum, fill) => sum + fill.swap, 0),
  }
}

export function redactSensitiveText(value: string) {
  return value.replace(/((?:api[_ -]?key|token|password|authorization)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]')
}

export function buildExplanation(record: Pick<TradeOutcomeV1, 'outcome' | 'netPnl' | 'facts' | 'observations' | 'hypotheses' | 'missingEvidence'>) {
  const confirmedFacts = record.facts.filter((item) => item.id && item.detail)
  const supportedObservations = record.observations.filter((item) => item.id && item.detail)
  const hypotheses = record.hypotheses.filter((item) => item.id && item.detail).map((item) => ({ ...item, uncertainty: 'Hypothesis; the available records do not confirm this cause.' }))
  return {
    confirmedFacts,
    supportedObservations,
    hypotheses,
    missingEvidence: record.missingEvidence,
    defaultLossExplanation: record.outcome === 'closed_loss' && confirmedFacts.length === 0
      ? 'The available records do not establish why this setup lost.'
      : null,
    lossMayFollowRules: record.outcome === 'closed_loss' && confirmedFacts.some((item) => /stop|rule followed/i.test(item.detail)),
  }
}
