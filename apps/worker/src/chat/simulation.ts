import type { TradeOutcomeV1 } from '../history/model'

export type ChatAccount = {
  id: string
  owner_id: string
  label: string
  currency: string
  balance: number
  equity: number
  daily_pnl: number
  connected: number
}

export type ChatPosition = { id: string; symbol: string; side: string; volume: number; pnl: number }
export type ChatCommand = { id: string; operation: string; symbol: string; status: string; note: string; expires_at: string }
export type ChatDecision = { id: string; decision: string; rationale: string }
export type ChatContext = { account: ChatAccount; positions: ChatPosition[]; commands: ChatCommand[]; decision: ChatDecision | null; usage: { used: number; limit: number }; history?: TradeOutcomeV1[] }
export type ChatAnswer = { content: string; citations: string[] }

/** Deterministic simulation answerer. Stored user and record text are data only; no tools or provider are invoked. */
export function answerSimulationQuestion(question: string, context: ChatContext): ChatAnswer {
  const q = question.toLowerCase()
  const { account, positions, commands, decision, usage } = context
  if (/secret|api.?key|credential|password|another user|other account|sim-trader|sim-owner|sim-account/.test(q)) {
    return { content: 'I can only use records for the selected account. I cannot reveal credentials or look up another user’s account.', citations: [] }
  }
  if (/learn|lesson|adapt|training/.test(q)) {
    return { content: 'There are no validated learning or lesson records connected to this simulated account, so I cannot establish what the bot has learned.', citations: [] }
  }
  const history = context.history ?? []
  if (/allowance|quota|usage|left/.test(q)) {
    return { content: `Simulated chat allowance: ${Math.max(0, usage.limit - usage.used)} of ${usage.limit} daily replies remain (${usage.used} used). This is separate from the AI decision allowance.`, citations: [] }
  }
  if (/order type|trading capabilit|can .* account use/.test(q)) {
    return { content: 'Order-type capabilities are not connected to this simulation. I cannot confirm which order types a broker account supports.', citations: [] }
  }
  if (/reject|fail|blocked/.test(q)) {
    const attempts = history.filter((record) => record.recordType === 'attempt' && ['broker_rejected', 'risk_blocked', 'order_expired', 'submission_unknown', 'order_cancelled', 'skipped_hold'].includes(record.outcome))
    if (attempts.length) {
      const descriptions: Record<string, string> = {
        broker_rejected: 'Recorded broker rejection', risk_blocked: 'Risk guard blocked entry', order_expired: 'Order expired before execution',
        submission_unknown: 'Submission status unknown; broker acknowledgement is missing', order_cancelled: 'Order was cancelled', skipped_hold: 'Setup was skipped after a HOLD decision',
      }
      return { content: attempts.slice(0, 10).map((record) => `${record.id}: ${record.symbol} ${record.side ?? ''} — ${descriptions[record.outcome] ?? record.outcome}. ${record.exitReason ?? ''}`.trim()).join('\n'), citations: attempts.slice(0, 10).map((record) => record.id) }
    }
    const rejected = commands.filter((command) => ['rejected', 'expired', 'unknown'].includes(command.status))
    if (!rejected.length) return { content: 'No rejected, expired, or unknown command records are saved for this account.', citations: [] }
    return {
      content: rejected.map((command) => `${command.id}: ${command.operation} ${command.symbol} is ${command.status}. Saved note: “${command.note}”. A recorded risk-guard rejection is distinct from a broker rejection; these fixtures do not prove broker submission.`).join('\n'),
      citations: rejected.map((command) => command.id),
    }
  }
  if (/skip|skipped/.test(q)) {
    const skipped = history.find((record) => record.recordType === 'attempt' && record.outcome === 'skipped_hold')
    if (skipped) return { content: `${skipped.id}: ${skipped.symbol} setup was recorded as skipped after a HOLD decision. ${skipped.exitReason ?? 'The saved record does not include a more specific skip reason.'}`, citations: [skipped.id, ...skipped.facts.map((fact) => fact.id)] }
  }
  if (/skip|decision|why did it|setup|bot doing|status|now/.test(q)) {
    const cites = [decision?.id, ...commands.filter((item) => item.status === 'pending').map((item) => item.id)].filter((id): id is string => Boolean(id))
    return {
      content: `The selected account is ${account.connected ? 'marked connected in the simulation fixture' : 'marked offline in the simulation fixture'}. ${decision ? `Latest recorded decision: ${decision.decision}. Saved rationale: “${decision.rationale}”.` : 'No decision record is saved.'} This does not establish a live bot or broker state.`,
      citations: cites,
    }
  }
  if (/lose|loss|losing|negative/.test(q)) {
    const closedLosses = history.filter((record) => record.recordType === 'trade' && record.outcome === 'closed_loss')
    if (closedLosses.length) {
      const record = closedLosses.find((item) => q.includes(item.id.toLowerCase())) ?? closedLosses[0]
      const facts = record.facts.map((fact) => `Recorded fact: ${fact.detail}`).join('\n')
      const observations = record.observations.map((item) => `Observation: ${item.detail}`).join('\n')
      const hypotheses = record.hypotheses.map((item) => `Unconfirmed hypothesis: ${item.detail}`).join('\n')
      const missing = record.missingEvidence.length ? `Missing evidence: ${record.missingEvidence.join('; ')}` : ''
      const explanation = [facts, observations, hypotheses, missing].filter(Boolean).join('\n') || 'The available records do not establish why this trade lost.'
      return { content: `${record.id}: ${record.symbol} ${record.side ?? ''} closed with net P&L ${record.netPnl === null ? 'not recorded' : `${record.netPnl.toFixed(2)} ${record.currency}`} (${record.exitTime ?? 'exit time not recorded'}). A loss alone does not establish a rule violation.\n${explanation}`, citations: [record.id, ...record.facts.map((item) => item.id)] }
    }
    const negative = positions.filter((position) => position.pnl < 0)
    if (!negative.length) return { content: 'No negative open-position P&L is recorded. There is no reconciled trade history here to explain a completed loss.', citations: [] }
    return { content: `The account has ${negative.map((position) => `${position.id} (${position.symbol}, open ${position.side}, ${position.pnl.toFixed(2)} ${account.currency} unrealized P&L)`).join('; ')}. These are open-position snapshots, not closed trades. The saved records do not establish why a completed trade lost.`, citations: negative.map((position) => position.id) }
  }
  if (/last|recent|history|closed trade|trade(s)?\b/.test(q) && !/skip|decision|doing/.test(q)) {
    const trades = history.filter((record) => record.recordType === 'trade').slice(0, 10)
    if (!trades.length) return { content: 'No completed trade records are available for this account. The shared history contains no trade outcomes yet; open positions are not completed trades.', citations: [] }
    const rows = trades.map((record) => `${record.id} | ${record.exitTime ?? record.entryTime ?? 'time unavailable'} | ${record.symbol} ${record.side ?? ''} | ${record.outcome} | ${record.netPnl === null ? 'net P&L unavailable' : `${record.netPnl.toFixed(2)} ${record.currency}`}`)
    return { content: `Latest ${trades.length} simulated trade record(s):\n${rows.join('\n')}`, citations: trades.map((record) => record.id) }
  }
  if (/account|balance|summary|position|p&l|pnl/.test(q)) {
    const citations = positions.map((position) => position.id)
    return { content: `${account.label}: balance ${account.balance.toFixed(2)} ${account.currency}, equity ${account.equity.toFixed(2)} ${account.currency}, daily P&L ${account.daily_pnl.toFixed(2)} ${account.currency}, ${positions.length} open position(s). Values are simulated account snapshots.`, citations }
  }
  return { content: 'I can summarize this simulated account, open positions, saved decisions, and command outcomes. Completed trade history, learning records, broker capabilities, and live account state are not connected. Ask about one of those saved records, or ask “show my trades” to see the available history status.', citations: [] }
}

export function normalizeChatQuestion(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const clean = value.trim()
  if (clean.length < 1 || clean.length > 2000) return null
  return clean
}

