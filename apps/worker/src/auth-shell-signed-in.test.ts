import { describe, expect, it, vi } from 'vitest'

vi.mock('./auth', () => ({
  createAuth: () => ({ api: { getSession: async () => ({ user: { id: 'test-user' } }) } }),
}))

import app from './index'

describe('signed-in workspace shell', () => {
  it('serves the root SPA asset without an asset redirect', async () => {
    let fetchedPath = ''
    const env = {
      DB: {} as D1Database,
      ASSETS: {
        fetch: async (request: Request) => {
          fetchedPath = new URL(request.url).pathname
          return fetchedPath === '/index.html'
            ? Response.redirect('http://127.0.0.1:5173/', 307)
            : new Response('<html>workspace</html>', { headers: { 'content-type': 'text/html' } })
        },
      },
      APP_BASE_URL: 'http://127.0.0.1:5173',
      BETTER_AUTH_SECRET: 'test-only-secret-with-at-least-32-characters',
    }
    const response = await app.request('http://127.0.0.1:5173/app', { headers: { cookie: 'better-auth.session_token=test-only' } }, env)
    expect(response.status).toBe(200)
    expect(fetchedPath).toBe('/')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
})
