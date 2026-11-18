import { describe, expect, it } from 'vitest'
import { digestSecret, normalizeSnapshot } from './model'

const now = new Date('2026-11-18T08:00:30.000Z')
const valid = () => ({
  observedAt: '2026-11-18T08:00:00.000Z',
  account: { broker: 'FxPro', server: 'FxPro-MT5 Demo', login: '1234567', environment: 'DEMO', currency: 'USD', balance: 10000, equity: 9988.5, marginUsed: 100, marginFree: 9888.5, floatingProfit: -11.5 },
  positions: [{ ticket: '84521', symbol: 'EURUSD', side: 'BUY', volume: 0.1, priceOpen: 1.1, priceCurrent: 1.099, profit: -11.5, stop: 1.09, target: 1.12 }],
})

describe('broker snapshot boundary', () => {
  it('accepts a bounded demo snapshot and preserves account identity', () => {
    expect(normalizeSnapshot(valid(), now)).toMatchObject({ account: { broker: 'FxPro', server: 'FxPro-MT5 Demo', login: '1234567', environment: 'DEMO' }, positions: [{ ticket: '84521' }] })
  })

  it('rejects a snapshot with stale or future observation time', () => {
    const stale = valid()
    stale.observedAt = '2026-11-18T07:57:00.000Z'
    expect(() => normalizeSnapshot(stale, now)).toThrow('SNAPSHOT_TIME_INVALID')
    const future = valid()
    future.observedAt = '2026-11-18T08:01:30.000Z'
    expect(() => normalizeSnapshot(future, now)).toThrow('SNAPSHOT_TIME_INVALID')
  })

  it('rejects missing account identity and unknown environment', () => {
    const missing = valid()
    missing.account.login = ''
    expect(() => normalizeSnapshot(missing, now)).toThrow('SNAPSHOT_ACCOUNT_INVALID')
    const unknown = valid()
    unknown.account.environment = 'SIMULATED'
    expect(() => normalizeSnapshot(unknown, now)).toThrow('SNAPSHOT_ACCOUNT_INVALID')
  })

  it('requires finite account margin and floating profit fields', () => {
    const missing = valid()
    delete (missing.account as Partial<typeof missing.account>).marginFree
    expect(() => normalizeSnapshot(missing, now)).toThrow('SNAPSHOT_ACCOUNT_INVALID')
    const nonfinite = valid()
    nonfinite.account.floatingProfit = Number.NaN
    expect(() => normalizeSnapshot(nonfinite, now)).toThrow('SNAPSHOT_ACCOUNT_INVALID')
  })

  it('rejects oversized positions and nonpositive prices', () => {
    const many = valid()
    many.positions = Array.from({ length: 101 }, (_, index) => ({ ...many.positions[0], ticket: String(index + 1) }))
    expect(() => normalizeSnapshot(many, now)).toThrow('SNAPSHOT_POSITIONS_INVALID')
    const badPrice = valid()
    badPrice.positions[0].priceCurrent = 0
    expect(() => normalizeSnapshot(badPrice, now)).toThrow('SNAPSHOT_POSITIONS_INVALID')
  })

  it('hashes bearer values without retaining plaintext', async () => {
    const digest = await digestSecret('test-only-secret')
    expect(digest).toMatch(/^[a-f0-9]{64}$/)
    expect(digest).not.toContain('test-only-secret')
    expect(await digestSecret('different')).not.toBe(digest)
  })
})
