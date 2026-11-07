export type { TradeOutcomeV1, TradeOutcomeKind } from '../../../apps/worker/src/history/model'

export type HistoryPageResponse = {
  account: { id: string; label: string; currency: string; environment: string; mode: string }
  items: import('../../../apps/worker/src/history/model').TradeOutcomeV1[]
  nextCursor: string | null
  pageSize: number
  mode: 'SIMULATED'
  isLive: false
}
