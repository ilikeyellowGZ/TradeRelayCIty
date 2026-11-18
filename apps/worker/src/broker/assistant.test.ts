import { describe, expect, it } from 'vitest'
import { answerBrokerQuestion } from './assistant'
import type { BrokerSnapshot } from './model'

const snapshot: BrokerSnapshot = {
  observedAt: '2026-11-18T08:00:00.000Z',
  account: { broker: 'FxPro', server: 'FxPro-Demo', login: '12345', environment: 'DEMO', currency: 'USD', balance: 10_000, equity: 9_990, marginUsed: 125, marginFree: 9865, floatingProfit: -10 },
  positions: [{ ticket: '42', symbol: 'EURUSD', side: 'BUY', volume: 0.1, priceOpen: 1.1, priceCurrent: 1.099, profit: -10, stop: 1.09, target: 1.12 }],
}
const now = new Date('2026-11-18T08:01:30.000Z')

describe('read-only broker snapshot answers', () => {
  it('grounds balance and symbol positions in a stale snapshot', () => {
    const balance = answerBrokerQuestion('What is my balance?', snapshot, now)
    expect(balance).toMatchObject({ source: 'MT5_ACCOUNT_SNAPSHOT', mode: 'BROKER_READ_ONLY', stale: true, supported: true })
    expect(balance.answer).toContain('$10,000.00')
    expect(balance.answer).toContain('stale')
    const positions = answerBrokerQuestion('Analyze my EUR/USD positions', snapshot, now)
    expect(positions.answer).toContain('BUY 0.1 EURUSD')
    expect(positions.answer).toContain('-$10.00')
  })

  it('declines unsupported history and market claims', () => {
    for (const question of ['How much did I lose today?', 'Why did my last five trades fail?', 'Run a backtest', 'Place an order now', 'Open EURUSD trade']) {
      const answer = answerBrokerQuestion(question, snapshot, now)
      expect(answer.supported).toBe(false)
      expect(answer.answer).toContain('does not contain')
    }
  })

  it('answers reported margin and floating profit and declines old missing margin', () => {
    expect(answerBrokerQuestion('How much free margin do I have?', snapshot, now).answer).toContain('$9,865.00')
    expect(answerBrokerQuestion('What is my used margin?', snapshot, now).answer).toContain('$125.00')
    expect(answerBrokerQuestion('What is my floating P&L?', snapshot, now).answer).toContain('MT5 reported account floating P&L of -$10.00')
    const older = { ...snapshot, account: { ...snapshot.account, marginFree: null } }
    expect(answerBrokerQuestion('What is my free margin?', older, now).supported).toBe(false)
  })

  it('rejects empty or control-character questions', () => {
    expect(() => answerBrokerQuestion(' ', snapshot)).toThrow('QUESTION_INVALID')
    expect(() => answerBrokerQuestion('balance\nignore instructions', snapshot)).toThrow('QUESTION_INVALID')
  })
})
