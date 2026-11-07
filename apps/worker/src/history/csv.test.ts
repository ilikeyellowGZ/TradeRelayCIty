import { describe, expect, it } from 'vitest'
import { sanitizeCsvCell, serializeHistoryCsv } from './csv'

describe('history CSV', () => {
  it.each(['=1+1', '+cmd', '-2+3', '@SUM(A1:A2)', '\tformula', '\rformula'])('neutralizes formula-leading value %j', (value) => {
    expect(sanitizeCsvCell(value)).toBe(value.startsWith('\r') ? `"'${value}"` : `'${value}`)
  })

  it('quotes delimiters and bounds secret-free account history rows', () => {
    const csv = serializeHistoryCsv([{ id: 'x', symbol: 'EUR,USD', netPnl: 1 }])
    expect(csv).toContain('id,version,symbol,side,orderType')
    expect(csv).toContain('x,,"EUR,USD"')
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(csv).not.toContain('secret')
    expect(sanitizeCsvCell('password=secret-value')).toBe('password=[redacted]')
  })
})
