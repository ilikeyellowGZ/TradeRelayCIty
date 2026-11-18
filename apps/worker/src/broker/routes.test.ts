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
function setup() {
  const db = new SqliteD1()
  const app = new Hono()
  app.route('/api/broker', ownerBrokerRoutes)
  app.route('/api/connector', connectorBrokerRoutes)
  const env = { DB: db as unknown as D1Database, APP_BASE_URL: base, BETTER_AUTH_SECRET: 'test-only-secret-with-at-least-32-characters' }
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
})
