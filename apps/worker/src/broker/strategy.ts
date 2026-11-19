export type DemoStrategyConfig = {
  type: 'sweep_fvg_v1'
  symbol: 'EURUSD'
  sweepLookback: number
  displacementAtr: number
  minGapAtr: number
  rewardRisk: number
}

export const defaultDemoStrategy: DemoStrategyConfig = {
  type: 'sweep_fvg_v1', symbol: 'EURUSD', sweepLookback: 8,
  displacementAtr: 1.2, minGapAtr: 0.1, rewardRisk: 2,
}

export function normalizeDemoStrategy(input: unknown): DemoStrategyConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid strategy settings.')
  const item = input as Record<string, unknown>
  if (item.type !== 'sweep_fvg_v1' || item.symbol !== 'EURUSD') throw new Error('Only the EURUSD sweep and FVG DEMO strategy is supported.')
  const limits = { sweepLookback: [4, 16], displacementAtr: [0.8, 2], minGapAtr: [0.05, 0.3], rewardRisk: [1.5, 3] } as const
  for (const [key, [minimum, maximum]] of Object.entries(limits)) {
    const value = item[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum || (key === 'sweepLookback' && !Number.isInteger(value))) throw new Error(`Invalid ${key}.`)
  }
  return { type: 'sweep_fvg_v1', symbol: 'EURUSD', sweepLookback: item.sweepLookback as number, displacementAtr: item.displacementAtr as number, minGapAtr: item.minGapAtr as number, rewardRisk: item.rewardRisk as number }
}
