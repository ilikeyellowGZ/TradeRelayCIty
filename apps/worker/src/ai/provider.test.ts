import { describe, expect, it } from 'vitest'
import { MockAiProvider } from './provider'
import { validateModelOpinion } from './real-providers'

describe('mock AI provider', () => {
  it('returns an explicit HOLD without approving or creating orders', async () => {
    const result = await new MockAiProvider().decide({
      snapshotId: 'snapshot-test-1',
      candidate: { symbol: 'EURUSD', direction: 'BUY', entry: 1.1, stop: 1.09, target: 1.12, strategyVersion: '0.1.0' },
    })
    expect(result.decision).toBe('HOLD')
    expect(result.snapshotId).toBe('snapshot-test-1')
    expect(result.rationale).toMatch(/HOLD-only simulation/i)
  })
})

describe('real provider output boundary', () => {
  const input = {
    snapshotId: 'snapshot-test-2',
    candidate: { symbol: 'EURUSD', direction: 'BUY' as const, entry: 1.1, stop: 1.09, target: 1.12, strategyVersion: 'ict-v1' },
  }

  it('downgrades an invented or modified entry to HOLD', () => {
    const opinion = validateModelOpinion({ decision: 'BUY', symbol: 'GBPUSD', entry: 1.3, stop: 1.29, target: 1.32, rationale: 'Looks good', invalidation: 'Close below swing', modelScore: 0.7 }, input)
    expect(opinion.decision).toBe('HOLD')
    expect(opinion.entry).toBeNull()
  })

  it('rejects malformed provider output', () => {
    expect(() => validateModelOpinion({ decision: 'BUY', rationale: 'x'.repeat(501), invalidation: '', modelScore: 0.4 }, input)).toThrow('AI_INVALID_RESPONSE')
  })
})
