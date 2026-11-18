import { describe, expect, it } from 'vitest'
import app from '../index'

describe('broker route mounting', () => {
  it('keeps owner routes behind a session and connector uploads behind a token', async () => {
    const env = { DB: {} as D1Database, ASSETS: { fetch: async () => new Response('') }, APP_BASE_URL: 'https://test.example', BETTER_AUTH_SECRET: 'test-only-secret-with-at-least-32-characters' }
    expect((await app.request('https://test.example/api/broker/devices', undefined, env)).status).toBe(401)
    expect((await app.request('https://test.example/api/connector/snapshot', { method: 'POST', body: '{}' }, env)).status).toBe(401)
  })
})
