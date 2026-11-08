import { describe, expect, it } from 'vitest'
import app from './index'

const env = {
  DB: {} as D1Database,
  ASSETS: { fetch: async () => new Response('<html>workspace</html>') },
  APP_BASE_URL: 'http://127.0.0.1:5173',
  BETTER_AUTH_SECRET: 'test-only-secret-with-at-least-32-characters',
}

describe('password-protected workspace shell', () => {
  it.each(['/app', '/app/positions'])('redirects unsigned requests for %s to login', async (path) => {
    const response = await app.request(`http://127.0.0.1:5173${path}`, undefined, env)
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
  })
})
