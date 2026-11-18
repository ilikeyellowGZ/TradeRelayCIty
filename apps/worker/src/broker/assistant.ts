import type { BrokerSnapshot } from './model'

export type BrokerAnswer = {
  answer: string
  observedAt: string
  stale: boolean
  source: 'MT5_ACCOUNT_SNAPSHOT'
  mode: 'BROKER_READ_ONLY'
  supported: boolean
}

export function answerBrokerQuestion(question: string, snapshot: BrokerSnapshot, now = new Date()): BrokerAnswer {
  const text = question.trim()
  if (!text || text.length > 500 || /[\x00-\x1f\x7f]/.test(text)) throw new Error('QUESTION_INVALID')
  const lower = text.toLowerCase()
  const stale = now.getTime() - Date.parse(snapshot.observedAt) > 60_000
  const money = (value: number) => {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: snapshot.account.currency }).format(value) }
    catch { return `${value.toFixed(2)} ${snapshot.account.currency}` }
  }
  const prefix = `MT5 snapshot observed ${snapshot.observedAt}${stale ? ' (stale)' : ''}. `
  let detail: string
  let supported = true

  if (/\b(today|yesterday|last (five|5|ten|10)|histor(y|ical)|closed|backtest|strategy|market structure|indicator|why|risk|margin|leverage|spread|tick)\b/i.test(text)) {
    detail = 'This question needs broker history, market data, contract details, or strategy evidence that this snapshot does not contain.'
    supported = false
  } else if (/\b(position|positions|open trades?)\b/i.test(text)) {
    const pair = /\b([A-Z]{3})\s*\/\s*([A-Z]{3})\b/i.exec(text) ?? /\b([A-Z]{6})\b/i.exec(text)
    const symbol = pair ? (pair[2] ? `${pair[1]}${pair[2]}` : pair[1]).toUpperCase() : null
    const positions = symbol ? snapshot.positions.filter((position) => position.symbol.toUpperCase().startsWith(symbol)) : snapshot.positions
    detail = positions.length
      ? `${positions.length} open ${symbol ? `${symbol} ` : ''}position${positions.length === 1 ? '' : 's'}: ${positions.map((position) => `${position.side} ${position.volume} ${position.symbol}, floating P&L ${money(position.profit)}`).join('; ')}.`
      : `No open ${symbol ? `${symbol} ` : ''}positions were present in this snapshot.`
  } else if (/\b(equity)\b/i.test(text)) {
    detail = `Account equity was ${money(snapshot.account.equity)}.`
  } else if (/\b(balance)\b/i.test(text)) {
    detail = `Account balance was ${money(snapshot.account.balance)}.`
  } else if (/\b(floating|unrealized|open p\s*&\s*l|open profit|open loss)\b/i.test(text)) {
    const total = snapshot.positions.reduce((sum, position) => sum + position.profit, 0)
    detail = `Floating P&L across ${snapshot.positions.length} open position${snapshot.positions.length === 1 ? '' : 's'} was ${money(total)}.`
  } else if (/\b(account|broker|server|currency)\b/i.test(text)) {
    detail = `The bound account was ${snapshot.account.broker} on ${snapshot.account.server}, login ${snapshot.account.login}, ${snapshot.account.environment}, in ${snapshot.account.currency}.`
  } else {
    detail = 'I can answer balance, equity, floating P&L, open positions, and account identity from this snapshot. Other questions need additional verified data.'
    supported = false
  }
  return { answer: prefix + detail, observedAt: snapshot.observedAt, stale, source: 'MT5_ACCOUNT_SNAPSHOT', mode: 'BROKER_READ_ONLY', supported }
}
