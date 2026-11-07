import { describe, expect, it } from 'vitest'
import { boundedPageSize, buildHistoryQuery } from './repository'

describe('history query construction', () => {
  it('clamps pagination to 1–50 rows', () => {
    expect(boundedPageSize()).toBe(25)
    expect(boundedPageSize(0)).toBe(25)
    expect(boundedPageSize(-4)).toBe(1)
    expect(boundedPageSize(200)).toBe(50)
  })

  it('always binds owner, account and environment, then supported filters', () => {
    const { where, bindings } = buildHistoryQuery('owner-a', 'account-a', {
      view: 'executed', from: '2026-11-01', to: '2026-11-02', symbol: 'eurusd', direction: 'BUY',
      strategy: 'London continuation', status: 'closed', outcome: 'closed_profit', q: 'SIM-TKT-1001', limit: 1000,
    })
    expect(where).toContain('account_id = ? AND owner_id = ? AND environment = ?')
    expect(where).toContain('record_type = ?')
    expect(where).toContain('broker_ticket LIKE ?')
    expect(bindings.slice(0, 4)).toEqual(['account-a', 'owner-a', 'SIMULATED', 'trade'])
    expect(bindings).not.toContain('1000')
    expect(bindings).toContain('EURUSD')
    expect(bindings).toContain('closed_profit')
  })

  it('does not include unsupported values or interpolate user input into SQL', () => {
    const filters = { symbol: "x' OR 1=1 --", status: 'anything', q: "' OR 1=1 --%_" } as const
    const { where, bindings } = buildHistoryQuery('owner-a', 'account-a', filters)
    expect(where).not.toContain("x' OR 1=1")
    expect(bindings).not.toContain(filters.symbol)
    expect(bindings.at(-1)).toContain("' OR 1=1 --")
    expect(bindings.at(-1)).toContain('\\%\\_')
  })
})
