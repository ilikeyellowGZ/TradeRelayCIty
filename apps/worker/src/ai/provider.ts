export type AiCandidate = {
  symbol: string
  direction: 'BUY' | 'SELL'
  entry: number
  stop: number
  target: number
  strategyVersion: string
}

export type AiDecisionInput = { snapshotId: string; candidate: AiCandidate | null }
export type AiDecision = { decisionId: string; snapshotId: string; decision: 'HOLD' | 'BUY' | 'SELL'; symbol: string | null; rationale: string; expiresAt: string; modelScore?: number }

export interface AiProvider {
  decide(input: AiDecisionInput): Promise<AiDecision>
}

/** Deterministic offline provider. It never approves an entry. */
export class MockAiProvider implements AiProvider {
  async decide(input: AiDecisionInput): Promise<AiDecision> {
    return {
      decisionId: crypto.randomUUID(),
      snapshotId: input.snapshotId,
      decision: 'HOLD',
      symbol: input.candidate?.symbol ?? null,
      rationale: input.candidate ? 'Mock provider is configured for HOLD-only simulation; no order is created.' : 'No deterministic setup candidate was supplied; remain flat.',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }
  }
}
