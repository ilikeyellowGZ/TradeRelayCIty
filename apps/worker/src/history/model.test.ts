import { describe, expect, it } from 'vitest'
import { aggregateFills, buildExplanation, classifyOutcome, redactSensitiveText, resolveNetPnl, type TradeOutcomeV1 } from './model'

const trade = (overrides: Partial<TradeOutcomeV1> = {}): TradeOutcomeV1 => ({
  id: 'trade-test', version: 1, accountId: 'account-a', ownerId: 'owner-a', environment: 'SIMULATED', source: 'TradeRelayCity',
  recordType: 'trade', symbol: 'EURUSD', side: 'BUY', orderType: 'MARKET', volume: 0.1, entryTime: '2026-11-01T10:00:00.000Z',
  exitTime: '2026-11-01T11:00:00.000Z', averageEntryPrice: 1.1, averageExitPrice: 1.101, currency: 'USD', grossPnl: 10,
  commission: 1, swap: 0, otherCosts: 0, netPnl: 9, status: 'closed', outcome: 'closed_profit', exitReason: 'Target reached',
  strategy: 'Fixture strategy', strategyVersion: null, promptVersion: null, commandId: null, decisionId: null, brokerTicket: null,
  fills: [], timeline: [], facts: [], observations: [], hypotheses: [], missingEvidence: [], originalStop: 1.09, target: 1.101,
  requestedPrice: 1.1, slippage: null, ...overrides,
})

describe('trade history outcome model', () => {
  it('keeps profit, loss and the one-cent break-even tolerance separate', () => {
    expect(classifyOutcome(trade({ netPnl: 0.02 }))).toBe('closed_profit')
    expect(classifyOutcome(trade({ netPnl: -0.02 }))).toBe('closed_loss')
    expect(classifyOutcome(trade({ netPnl: 0.01 }))).toBe('closed_break_even')
  })

  it('does not turn rejection, HOLD or unknown submission into executed losses', () => {
    expect(classifyOutcome(trade({ recordType: 'attempt', netPnl: null, status: 'rejected', outcome: 'broker_rejected' }))).toBe('broker_rejected')
    expect(classifyOutcome(trade({ recordType: 'attempt', netPnl: null, status: 'unknown', outcome: 'submission_unknown' }))).toBe('submission_unknown')
    expect(classifyOutcome(trade({ recordType: 'attempt', netPnl: null, status: 'skipped', outcome: 'skipped_hold' }))).toBe('skipped_hold')
    expect(classifyOutcome(trade({ status: 'partially_closed', outcome: 'open_partial', exitTime: null, netPnl: 2 }))).toBe('open_partial')
  })

  it('explains only linked facts and does not infer a cause from negative P&L', () => {
    const result = buildExplanation(trade({ netPnl: -8, outcome: 'closed_loss', exitReason: null, facts: [], observations: [], hypotheses: [], missingEvidence: ['No decision snapshot recorded'] }))
    expect(result.confirmedFacts).toHaveLength(0)
    expect(result.defaultLossExplanation).toBe('The available records do not establish why this setup lost.')
    expect(result.missingEvidence).toContain('No decision snapshot recorded')
  })

  it('aggregates partial fills by deal role and uses inclusive broker net only once', () => {
    const total = aggregateFills([
      { id: 'in-a', ticket: 'a', occurredAt: '', side: 'BUY', role: 'entry', volume: 0.1, price: 1.1, commission: 0.5, swap: 0, grossPnl: 0, netPnl: null },
      { id: 'in-b', ticket: 'b', occurredAt: '', side: 'BUY', role: 'entry', volume: 0.1, price: 1.2, commission: 0.5, swap: 0, grossPnl: 0, netPnl: null },
      { id: 'out-a', ticket: 'c', occurredAt: '', side: 'SELL', role: 'exit', volume: 0.15, price: 1.25, commission: 0.75, swap: 0.1, grossPnl: 12, netPnl: 10 },
    ])
    expect(total.entryVolume).toBeCloseTo(0.2)
    expect(total.closedVolume).toBeCloseTo(0.15)
    expect(total.averageEntryPrice).toBeCloseTo(1.15)
    expect(total.averageExitPrice).toBe(1.25)
    expect(resolveNetPnl({ brokerNet: 10, grossPnl: 12, commission: 1.75, swap: 0.1, otherCosts: 0 })).toBe(10)
    expect(resolveNetPnl({ brokerNet: null, grossPnl: 12, commission: 1.75, swap: 0.1, otherCosts: 0.25 })).toBeCloseTo(9.9)
  })

  it('redacts credential-like diagnostic text', () => {
    expect(redactSensitiveText('authorization=secret token:abc123')).toBe('authorization=[redacted] token:[redacted]')
  })
})
