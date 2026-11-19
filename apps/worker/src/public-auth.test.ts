import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it, vi } from 'vitest'

const mail = vi.hoisted(() => ({ messages: [] as Array<{ to: string; subject: string; text: string }> }))
vi.mock('./auth-email', () => ({ sendAccountEmail: async (_config: unknown, message: { to: string; subject: string; text: string }) => {
  mail.messages.push(message)
} }))

import app from './index'

class SqliteD1 {
  readonly sqlite = new DatabaseSync(':memory:')
  constructor() {
    this.sqlite.exec(readFileSync(new URL('../../../migrations/0002_better_auth.sql', import.meta.url), 'utf8'))
    this.sqlite.exec(readFileSync(new URL('../../../migrations/0003_invitations.sql', import.meta.url), 'utf8'))
    this.sqlite.exec(readFileSync(new URL('../../../migrations/0008_owner_username_password.sql', import.meta.url), 'utf8'))
  }
  prepare(sql: string) {
    const statement = this.sqlite.prepare(sql)
    return { bind: (...values: unknown[]) => ({
      first: async () => statement.get(...values as Parameters<typeof statement.get>) ?? null,
      all: async () => ({ results: statement.all(...values as Parameters<typeof statement.all>) }),
      run: async () => ({ success: true, meta: statement.run(...values as Parameters<typeof statement.run>) }),
    }) }
  }
}

const base = 'https://test.example'
function setup(email = true) {
  mail.messages.length = 0
  const db = new SqliteD1()
  const env = {
    DB: db.sqlite as unknown as D1Database,
    ASSETS: { fetch: async () => new Response('<html>workspace</html>') },
    APP_BASE_URL: base,
    BETTER_AUTH_SECRET: 'test-only-secret-with-at-least-32-characters',
    RESEND_API_KEY: email ? 'test-key' : undefined,
    EMAIL_FROM: email ? 'TradeRelayCity <hello@example.test>' : undefined,
  }
  const request = (path: string, init?: RequestInit) => app.request(base + path, init, env)
  const post = (path: string, body: object) => request('/api/auth' + path, {
    method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  return { db, request, post }
}

describe('public account lifecycle', () => {
  it('creates an unverified user, verifies email, and permits username sign-in', async () => {
    const { db, request, post } = setup()
    const created = await post('/sign-up/email', {
      name: 'Test User', username: 'testuser', email: 'test@example.test', password: 'long-test-password',
    })
    expect(created.status).toBeLessThan(400)
    expect(db.sqlite.prepare('SELECT emailVerified FROM "user" WHERE username=?').get('testuser')).toMatchObject({ emailVerified: 0 })
    expect(mail.messages).toHaveLength(1)
    expect(mail.messages[0].to).toBe('test@example.test')

    const blocked = await post('/sign-in/username', { username: 'testuser', password: 'long-test-password' })
    expect(blocked.status).toBe(403)

    const link = mail.messages[0].text.match(/https:\/\/\S+/)?.[0]
    expect(link).toBeTruthy()
    const verified = await request(new URL(link!).pathname + new URL(link!).search)
    expect(verified.status).toBeLessThan(400)
    expect(db.sqlite.prepare('SELECT emailVerified FROM "user" WHERE username=?').get('testuser')).toMatchObject({ emailVerified: 1 })

    const signedIn = await post('/sign-in/username', { username: 'testuser', password: 'long-test-password' })
    expect(signedIn.status).toBe(200)
    expect(signedIn.headers.get('set-cookie')).toContain('session_token')

    const cookie = signedIn.headers.get('set-cookie')!.split(';', 1)[0]
    const workspace = await request('/app', { headers: { cookie } })
    expect(workspace.status).toBe(200)
  })

  it('resets a verified account password and revokes the old session', async () => {
    const { request, post } = setup()
    await post('/sign-up/email', {
      name: 'Test User', username: 'testuser', email: 'test@example.test', password: 'long-test-password',
    })
    const verifyUrl = new URL(mail.messages.at(-1)!.text.match(/https:\/\/\S+/)![0])
    await request(verifyUrl.pathname + verifyUrl.search)
    const signedIn = await post('/sign-in/username', { username: 'testuser', password: 'long-test-password' })
    const cookie = signedIn.headers.get('set-cookie')!.split(';', 1)[0]

    const resetRequested = await post('/request-password-reset', { email: 'test@example.test', redirectTo: `${base}/reset-password` })
    expect(resetRequested.status).toBe(200)
    const resetUrl = new URL(mail.messages.at(-1)!.text.match(/https:\/\/\S+/)![0])
    const callback = await request(resetUrl.pathname + resetUrl.search)
    expect(callback.status).toBe(302)
    const token = new URL(callback.headers.get('location')!, base).searchParams.get('token')
    expect(token).toMatch(/^[A-Za-z0-9_-]{24}$/)
    const changed = await post('/reset-password', { token, newPassword: 'new-long-test-password' })
    expect(changed.status).toBe(200)
    expect((await request('/app', { headers: { cookie } })).status).toBe(302)
    expect((await post('/sign-in/username', { username: 'testuser', password: 'long-test-password' })).status).toBe(401)
    expect((await post('/sign-in/username', { username: 'testuser', password: 'new-long-test-password' })).status).toBe(200)
  })

  it('keeps unwanted auth endpoints and cross-origin sign-up closed', async () => {
    const { request } = setup()
    expect((await request('/api/auth/sign-up/social', { method: 'POST', headers: { origin: base }, body: '{}' })).status).toBe(404)
    expect((await request('/api/auth/is-username-available', { method: 'POST', headers: { origin: base }, body: '{}' })).status).toBe(404)
    expect((await request('/api/auth/sign-up/email', { method: 'POST', headers: { origin: 'https://evil.example' }, body: '{}' })).status).toBe(403)
  })

  it('does not create a second user for duplicate email or accept a forged verification link', async () => {
    const { db, request, post } = setup()
    const signup = { name: 'Test User', username: 'testuser', email: 'test@example.test', password: 'long-test-password' }
    expect((await post('/sign-up/email', signup)).status).toBeLessThan(400)
    const duplicate = await post('/sign-up/email', { ...signup, username: 'otheruser' })
    expect(duplicate.status).toBeLessThan(400)
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM "user" WHERE email=?').get('test@example.test')).toMatchObject({ n: 1 })
    const forged = await request('/api/auth/verify-email?token=invalid-token&callbackURL=%2Flogin')
    expect(forged.status).toBeGreaterThanOrEqual(300)
    expect(db.sqlite.prepare('SELECT emailVerified FROM "user" WHERE username=?').get('testuser')).toMatchObject({ emailVerified: 0 })
  })

  it('fails closed when mail delivery is unconfigured', async () => {
    const { post } = setup(false)
    const response = await post('/sign-up/email', {
      name: 'Test User', username: 'testuser', email: 'test@example.test', password: 'long-test-password',
    })
    expect(response.status).toBe(503)
  })

  it('verifies only the pre-existing internal bootstrap owner during migration', () => {
    const { db } = setup()
    db.sqlite.exec(`INSERT INTO "user" (id,name,email,emailVerified,createdAt,updatedAt,username) VALUES
      ('owner','Owner','owner-owner@traderelaycity.invalid',0,0,0,'owner'),
      ('member','Member','member@example.test',0,0,0,'member');
      INSERT INTO app_settings(key,value) VALUES ('owner_user_id','owner');`)
    db.sqlite.exec(readFileSync(new URL('../../../migrations/0014_public_auth.sql', import.meta.url), 'utf8'))
    expect(db.sqlite.prepare('SELECT emailVerified FROM "user" WHERE id=?').get('owner')).toMatchObject({ emailVerified: 1 })
    expect(db.sqlite.prepare('SELECT emailVerified FROM "user" WHERE id=?').get('member')).toMatchObject({ emailVerified: 0 })
  })
})
