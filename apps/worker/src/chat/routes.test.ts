import { readFileSync, readdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import app from '../index'

function setup(ai: Record<string, string> = {}) {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys=ON')
  const migrations = new URL('../../../../migrations/', import.meta.url)
  for (const file of readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL(file, migrations), 'utf8'))
  const db = {
    prepare(sql: string) {
      const statement = sqlite.prepare(sql)
      const bound = (values: unknown[] = []) => ({
        bind: (...next: unknown[]) => bound(next),
        first: async () => statement.get(...values as Parameters<typeof statement.get>) ?? null,
        all: async () => ({ results: statement.all(...values as Parameters<typeof statement.all>) }),
        run: async () => ({ success: true, meta: statement.run(...values as Parameters<typeof statement.run>) }),
      })
      return bound()
    },
    batch: async (statements: Array<{ run: () => Promise<unknown> }>) => Promise.all(statements.map((statement) => statement.run())),
  }
  const base = 'http://127.0.0.1:5173'
  const env = { DB: db as unknown as D1Database, ASSETS: { fetch: async () => new Response('') }, SIMULATION_MODE: 'true', ...ai }
  const request = (path: string, body?: unknown, user = 'sim-owner') => app.request(base + path, { method: body ? 'POST' : 'GET', headers: { origin: base, 'content-type': 'application/json', 'x-simulation-user': user }, body: body ? JSON.stringify(body) : undefined }, env)
  return { sqlite, request }
}

afterEach(() => vi.restoreAllMocks())

describe('local assistant database and provider integration', () => {
  it('uses the configured AI to interpret a question and persists an answer from fixture records', async () => {
    const { sqlite, request } = setup({ AI_PROVIDER: 'groq', AI_MODEL: 'openai/gpt-oss-20b', GROQ_API_KEY: 'test-only-key' })
    const capability = await request('/api/simulation/ai-capabilities')
    expect(await capability.json()).toMatchObject({ available: true, provider: 'groq' })
    const created = await request('/api/simulation/chat', { accountId: 'sim-account-owner' })
    const { conversation } = await created.json() as { conversation: { id: string } }
    const provider = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"intent":"BALANCE","symbol":null}' } }], usage: { prompt_tokens: 20, completion_tokens: 8 } }))
    const response = await request(`/api/simulation/chat/${conversation.id}/messages`, { content: 'How much cash do I have?', useAi: true })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ provider: 'groq', mode: 'SIMULATED', messages: [{ content: 'How much cash do I have?' }, { content: expect.stringContaining('24580.00 USD'), simulated: true }] })
    expect(sqlite.prepare('SELECT count(*) AS count FROM sim_chat_messages').get()).toMatchObject({ count: 2 })
    expect(sqlite.prepare('SELECT request_count FROM sim_chat_usage_daily WHERE user_id=?').get('sim-owner')).toMatchObject({ request_count: 1 })
    expect((await request(`/api/simulation/chat/${conversation.id}`, undefined, 'sim-trader-1')).status).toBe(404)
    expect(provider).toHaveBeenCalledTimes(1)
    expect(String(provider.mock.calls[0][1]?.body)).not.toContain('24580')
    expect(String(provider.mock.calls[0][1]?.body)).not.toContain('test-only-key')
    const stored = await request(`/api/simulation/chat/${conversation.id}`)
    expect(await stored.json()).toMatchObject({ conversation: { messages: [{ role: 'user' }, { role: 'assistant', content: expect.stringContaining('24580.00 USD') }] } })
    sqlite.close()
  })

  it('returns a usable configuration error instead of pretending a requested AI call succeeded', async () => {
    const { sqlite, request } = setup()
    const created = await request('/api/simulation/chat', { accountId: 'sim-account-owner' })
    const { conversation } = await created.json() as { conversation: { id: string } }
    const response = await request(`/api/simulation/chat/${conversation.id}/messages`, { content: 'How much cash do I have?', useAi: true })
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'AI_NOT_CONFIGURED' })
    expect(sqlite.prepare('SELECT count(*) AS count FROM sim_chat_messages').get()).toMatchObject({ count: 0 })
    sqlite.close()
  })
})
