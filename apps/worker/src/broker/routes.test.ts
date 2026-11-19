import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../auth', () => ({
  createAuth: () => ({ api: { getSession: async ({ headers }: { headers: Headers }) => {
    const cookie = headers.get('cookie')
    return cookie === 'session=owner' ? { user: { id: 'owner-a' } } : cookie === 'session=other' ? { user: { id: 'owner-b' } } : null
  } } }),
}))

import { connectorBrokerRoutes, ownerBrokerRoutes } from './routes'

class SqliteD1 {
  readonly sqlite = new DatabaseSync(':memory:')

  constructor() {
    this.sqlite.exec('PRAGMA foreign_keys=ON; CREATE TABLE "user" (id TEXT PRIMARY KEY); CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL); INSERT INTO "user" VALUES (\'owner-a\'); INSERT INTO "user" VALUES (\'owner-b\'); INSERT INTO app_settings VALUES (\'owner_user_id\',\'owner-a\');')
    this.sqlite.exec(readFileSync(new URL('../../../../migrations/0009_connector_pairing.sql', import.meta.url), 'utf8'))
    this.sqlite.exec(readFileSync(new URL('../../../../migrations/0010_broker_account_metrics.sql', import.meta.url), 'utf8'))
    this.sqlite.exec(readFileSync(new URL('../../../../migrations/0011_connector_status.sql', import.meta.url), 'utf8'))
    this.sqlite.exec(readFileSync(new URL('../../../../migrations/0012_broker_ai_usage.sql', import.meta.url), 'utf8'))
    this.sqlite.exec(readFileSync(new URL('../../../../migrations/0013_broker_demo_decisions.sql', import.meta.url), 'utf8'))
  }

  prepare(sql: string) {
    const statement = this.sqlite.prepare(sql)
    return {
      bind: (...values: unknown[]) => ({
        first: async () => statement.get(...values as Parameters<typeof statement.get>) ?? null,
        all: async () => ({ results: statement.all(...values as Parameters<typeof statement.all>) }),
        run: async () => ({ success: true, meta: statement.run(...values as Parameters<typeof statement.run>) }),
      }),
    }
  }
}

const base = 'https://test.example'
function setup(ai: Record<string, string> = {}) {
  const db = new SqliteD1()
  const app = new Hono()
  app.route('/api/broker', ownerBrokerRoutes)
  app.route('/api/connector', connectorBrokerRoutes)
  const env = { DB: db as unknown as D1Database, APP_BASE_URL: base, BETTER_AUTH_SECRET: 'test-only-secret-with-at-least-32-characters', ...ai }
  const request = (path: string, init?: RequestInit) => app.request(base + path, init, env)
  const ownerHeaders = { cookie: 'session=owner', origin: base, 'content-type': 'application/json' }
  return { db, request, ownerHeaders }
}

const snapshot = () => ({
  observedAt: new Date().toISOString(),
  account: { broker: 'FxPro', server: 'FxPro-MT5 Demo', login: '12345', environment: 'DEMO', currency: 'USD', balance: 10000, equity: 9998, marginUsed: 120, marginFree: 9878, floatingProfit: -2 },
  positions: [{ ticket: '42', symbol: 'EURUSD', side: 'BUY', volume: 0.1, priceOpen: 1.1, priceCurrent: 1.101, profit: 8, stop: 1.09, target: 1.12 }],
})

describe('connector pairing and snapshots', () => {
  it('denies unsigned, foreign-owner, and cross-origin browser requests', async () => {
    const { request, ownerHeaders } = setup()
    expect((await request('/api/broker/devices')).status).toBe(401)
    expect((await request('/api/broker/devices', { headers: { cookie: 'session=other' } })).status).toBe(403)
    expect((await request('/api/broker/pairing-codes', { method: 'POST', headers: { ...ownerHeaders, origin: 'https://evil.example' }, body: '{}' })).status).toBe(403)
    expect((await request('/api/connector/snapshot', { method: 'POST', body: '{}' })).status).toBe(401)
    expect((await request('/api/broker/ai-capabilities', { headers: ownerHeaders }).then((response) => response.json()) as { available: boolean }).available).toBe(false)
  })

  it('pairs once, binds one account, exposes its snapshot, and revokes the device', async () => {
    const { request, ownerHeaders } = setup()
    const codeResponse = await request('/api/broker/pairing-codes', { method: 'POST', headers: ownerHeaders, body: '{}' })
    expect(codeResponse.status).toBe(201)
    const { code } = await codeResponse.json() as { code: string }
    expect(code).toMatch(/^[A-Z2-9]{20}$/)
    const pair = await request('/api/connector/pair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, name: 'Windows PC' }) })
    expect(pair.status).toBe(201)
    const { token, deviceId } = await pair.json() as { token: string; deviceId: string }
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect((await request('/api/connector/pair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, name: 'Replay' }) })).status).toBe(401)

    const bearerHeaders = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
    expect((await request('/api/connector/status', { method: 'POST', body: JSON.stringify({ state: 'MCP_OFFLINE' }) })).status).toBe(401)
    expect((await request('/api/connector/status', { method: 'POST', headers: bearerHeaders, body: JSON.stringify({ state: 'SYNCED' }) })).status).toBe(400)
    expect((await request('/api/connector/status', { method: 'POST', headers: bearerHeaders, body: JSON.stringify({ state: 'MCP_OFFLINE' }) })).status).toBe(200)
    expect((await request('/api/connector/status', { method: 'POST', headers: bearerHeaders, body: JSON.stringify({ state: 'MCP_OFFLINE' }) })).status).toBe(200)
    const offlineDevices = await request('/api/broker/devices', { headers: ownerHeaders })
    expect((await offlineDevices.json() as { devices: Array<{ lastState: string }> }).devices[0].lastState).toBe('MCP_OFFLINE')
    const upload = await request('/api/connector/snapshot', { method: 'POST', headers: bearerHeaders, body: JSON.stringify(snapshot()) })
    expect(upload.status).toBe(200)
    const accounts = await request('/api/broker/accounts', { headers: ownerHeaders })
    expect(accounts.status).toBe(200)
    const accountList = (await accounts.json() as { accounts: Array<{ id: string; balance: number; marginUsed: number; marginFree: number; floatingProfit: number; positions: Array<{ ticket: string }>; stale: boolean }> }).accounts
    expect(accountList[0]).toMatchObject({ balance: 10000, marginUsed: 120, marginFree: 9878, floatingProfit: -2, positions: [{ ticket: '42' }], stale: false })
    const eventsPath = `/api/broker/devices/${deviceId}/events`
    expect((await request(eventsPath, { headers: { cookie: 'session=other' } })).status).toBe(403)
    const events = await request(eventsPath, { headers: ownerHeaders })
    expect((await events.json() as { events: Array<{ state: string }> }).events.map((event) => event.state)).toEqual(['SYNCED', 'MCP_OFFLINE', 'PAIRED'])
    const questionPath = `/api/broker/accounts/${accountList[0].id}/questions`
    expect((await request(questionPath, { method: 'POST', headers: { ...ownerHeaders, cookie: 'session=other' }, body: JSON.stringify({ question: 'balance' }) })).status).toBe(403)
    const answerResponse = await request(questionPath, { method: 'POST', headers: ownerHeaders, body: JSON.stringify({ question: 'What is my balance?' }) })
    expect(answerResponse.status).toBe(200)
    expect((await answerResponse.json() as { answer: string; mode: string })).toMatchObject({ mode: 'BROKER_READ_ONLY', answer: expect.stringContaining('$10,000.00') })
    const marginResponse = await request(questionPath, { method: 'POST', headers: ownerHeaders, body: JSON.stringify({ question: 'What is my free margin?' }) })
    expect((await marginResponse.json() as { answer: string }).answer).toContain('$9,878.00')

    const switched = snapshot()
    switched.account.login = '98765'
    expect((await request('/api/connector/snapshot', { method: 'POST', headers: bearerHeaders, body: JSON.stringify(switched) })).status).toBe(409)
    expect((await request(`/api/broker/devices/${deviceId}`, { method: 'DELETE', headers: ownerHeaders })).status).toBe(200)
    expect((await request('/api/connector/snapshot', { method: 'POST', headers: bearerHeaders, body: JSON.stringify(snapshot()) })).status).toBe(401)
    expect((await request('/api/connector/status', { method: 'POST', headers: bearerHeaders, body: JSON.stringify({ state: 'MCP_ERROR' }) })).status).toBe(401)
  })

  it('rejects expired pairing codes', async () => {
    const { db, request, ownerHeaders } = setup()
    const response = await request('/api/broker/pairing-codes', { method: 'POST', headers: ownerHeaders, body: '{}' })
    const { code } = await response.json() as { code: string }
    db.sqlite.exec('UPDATE connector_pairing_codes SET expires_at=0')
    expect((await request('/api/connector/pair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, name: 'Late' }) })).status).toBe(401)
  })

  it('classifies an owned broker question with a bounded server-side provider request', async () => {
    const { db, request, ownerHeaders } = setup({ BROKER_AI_PROVIDER: 'openai', BROKER_AI_MODEL: 'gpt-test', OPENAI_API_KEY: 'test-only-key' })
    const codeResponse = await request('/api/broker/pairing-codes', { method: 'POST', headers: ownerHeaders, body: '{}' })
    const { code } = await codeResponse.json() as { code: string }
    const pair = await request('/api/connector/pair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, name: 'Windows PC' }) })
    const { token } = await pair.json() as { token: string }
    await request('/api/connector/snapshot', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(snapshot()) })
    const accountResponse = await request('/api/broker/accounts', { headers: ownerHeaders })
    const { accounts } = await accountResponse.json() as { accounts: Array<{ id: string }> }
    const path = `/api/broker/accounts/${accounts[0].id}/ai-questions`
    expect((await request('/api/broker/ai-capabilities', { headers: ownerHeaders }).then((response) => response.json()) as { available: boolean }).available).toBe(true)
    expect((await request(path, { method: 'POST', headers: { ...ownerHeaders, cookie: 'session=other' }, body: JSON.stringify({ question: 'How much is in my account?' }) })).status).toBe(403)
    const provider = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      id: 'provider-1', status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '{"intent":"BALANCE","symbol":null}' }] }], usage: { input_tokens: 12, output_tokens: 5 },
    }), { status: 200 }))
    try {
      const response = await request(path, { method: 'POST', headers: ownerHeaders, body: JSON.stringify({ question: 'How much is in my account?' }) })
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ supported: true, classification: 'AI_INTENT', answer: expect.stringContaining('$10,000.00'), classifier: { provider: 'openai', model: 'gpt-test' } })
      const blocked = await request(path, { method: 'POST', headers: ownerHeaders, body: JSON.stringify({ question: 'Place a trade now' }) })
      expect((await blocked.json() as { supported: boolean; classification: string })).toMatchObject({ supported: false, classification: 'UNAVAILABLE' })
      expect(provider).toHaveBeenCalledTimes(1)
      db.sqlite.prepare('UPDATE broker_ai_daily_usage SET request_count=30 WHERE owner_id=? AND day_utc=?').run('owner-a', new Date().toISOString().slice(0, 10))
      expect((await request(path, { method: 'POST', headers: ownerHeaders, body: JSON.stringify({ question: 'How much is in my account?' }) })).status).toBe(429)
      expect(provider).toHaveBeenCalledTimes(1)
    } finally { provider.mockRestore() }
  })

  it('requires a fresh bound demo snapshot and records the AI opinion', async () => {
    const { db, request, ownerHeaders } = setup({ AI_PROVIDER: 'groq', AI_MODEL: 'openai/gpt-oss-20b', GROQ_API_KEY: 'test-only-key' })
    const codeResponse = await request('/api/broker/pairing-codes', { method: 'POST', headers: ownerHeaders, body: '{}' })
    const { code } = await codeResponse.json() as { code: string }
    const pair = await request('/api/connector/pair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, name: 'Demo PC' }) })
    const { token, deviceId } = await pair.json() as { token: string; deviceId: string }
    const bearerHeaders = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
    const current = snapshot()
    current.positions = []
    expect((await request('/api/connector/snapshot', { method: 'POST', headers: bearerHeaders, body: JSON.stringify(current) })).status).toBe(200)
    const { accounts } = await (await request('/api/broker/accounts', { headers: ownerHeaders })).json() as { accounts: Array<{ id: string }> }
    const bars = Array.from({ length: 20 }, (_, index) => ({ time: new Date(Date.now() - (21 - index) * 60_000).toISOString(), open: 1.1, high: 1.101, low: 1.099, close: 1.1 }))
    const body = { accountId: accounts[0].id, snapshotId: current.observedAt, setupTime: new Date(Date.now() - 60_000).toISOString(), candidate: { symbol: 'EURUSD', direction: 'BUY', entry: 1.1, stop: 1.095, target: 1.11, strategyVersion: '0.1.0' }, marketSnapshot: { signalBars: bars, higherBars: bars } }
    expect((await request('/api/connector/demo/opinion', { method: 'POST', body: JSON.stringify(body) })).status).toBe(401)
    expect((await request('/api/connector/demo/opinion', { method: 'POST', headers: bearerHeaders, body: JSON.stringify({ ...body, snapshotId: 'stale' }) })).status).toBe(409)
    const provider = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      id: 'ai-1', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ decision: 'BUY', symbol: 'EURUSD', entry: 1.1, stop: 1.095, target: 1.11, rationale: 'Candidate confirmed', invalidation: 'Stop reached', modelScore: 0.7 }) } }],
      usage: { prompt_tokens: 200, completion_tokens: 30 },
    }), { status: 200 }))
    try {
      const response = await request('/api/connector/demo/opinion', { method: 'POST', headers: bearerHeaders, body: JSON.stringify(body) })
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ approved: true, decision: 'BUY', symbol: 'EURUSD', provider: 'groq' })
      expect(db.sqlite.prepare('SELECT side,provider FROM broker_demo_decisions').get()).toMatchObject({ side: 'BUY', provider: 'groq' })
      expect(provider).toHaveBeenCalledTimes(1)
    } finally { provider.mockRestore() }
    expect((await request(`/api/broker/devices/${deviceId}`, { method: 'DELETE', headers: ownerHeaders })).status).toBe(200)
    expect((await request('/api/connector/demo/opinion', { method: 'POST', headers: bearerHeaders, body: JSON.stringify(body) })).status).toBe(401)
  })
})
