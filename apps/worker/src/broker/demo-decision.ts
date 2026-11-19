import type { AiCandidate } from '../ai/provider'

export type DemoDecisionRequest = {
  accountId: string
  strategyId: string
  snapshotId: string
  setupTime: string
  candidate: AiCandidate
  marketSnapshot: { signalBars: unknown[]; higherBars: unknown[] }
}

export function normalizeDemoDecisionRequest(value: unknown): DemoDecisionRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('DEMO_DECISION_INVALID')
  const item = value as Record<string, unknown>
  const candidate = item.candidate as Record<string, unknown> | null
  const market = item.marketSnapshot as Record<string, unknown> | null
  if (!candidate || !market || typeof item.accountId !== 'string' || !/^[0-9a-f-]{36}$/.test(item.accountId) ||
    typeof item.strategyId !== 'string' || !/^[0-9a-f-]{36}$/.test(item.strategyId) ||
    typeof item.snapshotId !== 'string' || item.snapshotId.length > 100 ||
    typeof item.setupTime !== 'string' || !Number.isFinite(Date.parse(item.setupTime)) ||
    candidate.symbol !== 'EURUSD' || !['BUY', 'SELL'].includes(String(candidate.direction)) ||
    candidate.strategyVersion !== '0.1.0' ||
    ![candidate.entry, candidate.stop, candidate.target].every((n) => typeof n === 'number' && Number.isFinite(n) && n > 0) ||
    (candidate.direction === 'BUY' && !(Number(candidate.stop) < Number(candidate.entry) && Number(candidate.entry) < Number(candidate.target))) ||
    (candidate.direction === 'SELL' && !(Number(candidate.target) < Number(candidate.entry) && Number(candidate.entry) < Number(candidate.stop))) ||
    !Array.isArray(market.signalBars) || !Array.isArray(market.higherBars) ||
    market.signalBars.length < 20 || market.signalBars.length > 30 ||
    market.higherBars.length < 20 || market.higherBars.length > 30) throw new Error('DEMO_DECISION_INVALID')
  for (const bars of [market.signalBars, market.higherBars]) {
    let previous = -Infinity
    for (const raw of bars) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('DEMO_DECISION_INVALID')
      const bar = raw as Record<string, unknown>
      const time = typeof bar.time === 'string' ? Date.parse(bar.time) : NaN
      if (!Number.isFinite(time) || time <= previous || !['open', 'high', 'low', 'close'].every((field) => typeof bar[field] === 'number' && Number.isFinite(bar[field]) && Number(bar[field]) > 0) ||
        Number(bar.high) < Math.max(Number(bar.open), Number(bar.close), Number(bar.low)) || Number(bar.low) > Math.min(Number(bar.open), Number(bar.close), Number(bar.high))) throw new Error('DEMO_DECISION_INVALID')
      previous = time
    }
  }
  return item as DemoDecisionRequest
}
