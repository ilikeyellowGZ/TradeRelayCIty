import { afterEach, describe, expect, it, vi } from 'vitest'
import { draftDemoStrategy } from './strategy-draft'

afterEach(() => vi.restoreAllMocks())

describe('AI DEMO strategy drafts', () => {
  const env = { AI_PROVIDER: 'groq', AI_MODEL: 'openai/gpt-oss-20b', GROQ_API_KEY: 'test-key' }
  const response = (value: unknown) => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] }), { status: 200 })

  it('returns only bounded settings for the supported template', async () => {
    const request = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ name: 'Selective sweep', explanation: 'Uses stronger displacement.', sweepLookback: 8, displacementAtr: 1.6, minGapAtr: 0.12, rewardRisk: 2 }))
    const draft = await draftDemoStrategy(env, 'Use a stronger EURUSD displacement candle and a wider gap.')
    expect(draft.config).toEqual({ type: 'sweep_fvg_v1', symbol: 'EURUSD', sweepLookback: 8, displacementAtr: 1.6, minGapAtr: 0.12, rewardRisk: 2 })
    const body = JSON.parse(String(request.mock.calls[0][1]?.body)) as { messages: Array<{ content: string }> }
    expect(body.messages[1].content).toContain('stronger EURUSD')
  })

  it('rejects out of range model settings', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ name: 'Unsafe target', explanation: '', sweepLookback: 8, displacementAtr: 1.2, minGapAtr: 0.1, rewardRisk: 100 }))
    await expect(draftDemoStrategy(env, 'Set a target one hundred times the stop distance.')).rejects.toThrow('Invalid rewardRisk')
  })
})
