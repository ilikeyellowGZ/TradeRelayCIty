import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { createAuth } from './auth'
import app from './index'

class SqliteD1 {
  readonly sqlite = new DatabaseSync(':memory:')
  constructor() {
    for (const name of ['0002_better_auth.sql', '0008_owner_username_password.sql', '0015_account_recovery.sql']) {
      this.sqlite.exec(readFileSync(new URL(`../../../migrations/${name}`, import.meta.url), 'utf8'))
    }
  }
  prepare(sql: string) {
    const db = this.sqlite
    const bound = (values: unknown[]) => ({
      sql, values,
      bind: (...next: unknown[]) => bound(next),
      first: async () => db.prepare(sql).get(...values as Parameters<ReturnType<DatabaseSync['prepare']>['get']>) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...values as Parameters<ReturnType<DatabaseSync['prepare']>['all']>), meta: { changes: 0, last_row_id: 0 } }),
      run: async () => ({ success: true, meta: db.prepare(sql).run(...values as Parameters<ReturnType<DatabaseSync['prepare']>['run']>) }),
    })
    return bound([])
  }
  async exec(sql: string) { this.sqlite.exec(sql); return { count: 1, duration: 0 } }
  async batch(statements: Array<{ sql: string; values: unknown[] }>) {
    this.sqlite.exec('BEGIN')
    try {
      const results = statements.map(({ sql, values }) => {
        const statement = this.sqlite.prepare(sql)
        return /\bRETURNING\b|^\s*(SELECT|PRAGMA|WITH)\b/i.test(sql) ? { results: statement.all(...values as Parameters<typeof statement.all>) } : { results: [], meta: statement.run(...values as Parameters<typeof statement.run>) }
      })
      this.sqlite.exec('COMMIT')
      return results
    } catch (error) { this.sqlite.exec('ROLLBACK'); throw error }
  }
}

const base = 'https://test.example'
const secret = 'test-only-secret-with-at-least-32-characters'
function setup() {
  const db = new SqliteD1()
  const env = { DB: db as unknown as D1Database, ASSETS: { fetch: async () => new Response('<html>workspace</html>') }, APP_BASE_URL: base, BETTER_AUTH_SECRET: secret }
  const request = (path: string, init?: RequestInit) => app.request(base + path, init, env)
  const post = (path: string, data: object, origin = base) => request(path, { method: 'POST', headers: { origin, 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.10' }, body: JSON.stringify(data) })
  const signIn = (username: string, password: string) => createAuth({ DB: db.sqlite as unknown as D1Database, APP_BASE_URL: base, BETTER_AUTH_SECRET: secret }).handler(new Request(base + '/api/auth/sign-in/username', { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) }))
  return { db, request, post, signIn }
}

describe('public accounts with recovery codes', () => {
  const registration = { name: 'Test User', username: 'testuser', password: 'long-test-password' }

  it('registers without email, stores only code hashes, and accepts username sign-in', async () => {
    const { db, request, post, signIn } = setup()
    const response = await post('/api/account/register', registration)
    expect(response.status).toBe(201)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const data = await response.json() as { recoveryCodes: string[] }
    expect(data.recoveryCodes).toHaveLength(8)
    expect(new Set(data.recoveryCodes).size).toBe(8)
    expect(data.recoveryCodes[0]).toMatch(/^[0-9A-F]{8}(?:-[0-9A-F]{8}){3}$/)
    const user = db.sqlite.prepare('SELECT id,email,emailVerified FROM "user" WHERE username=?').get('testuser') as { id: string; email: string; emailVerified: number }
    expect(user.email).toMatch(/@accounts\.traderelaycity\.invalid$/)
    expect(user.emailVerified).toBe(0)
    const stored = db.sqlite.prepare('SELECT code_hash FROM account_recovery_codes WHERE user_id=?').all(user.id) as Array<{ code_hash: string }>
    expect(stored).toHaveLength(8)
    expect(stored.some(({ code_hash }) => code_hash.includes(data.recoveryCodes[0]))).toBe(false)
    const signedIn = await signIn('testuser', registration.password)
    expect(signedIn.status).toBe(200)
    const cookie = signedIn.headers.get('set-cookie')!.split(';', 1)[0]
    expect((await request('/app', { headers: { cookie } })).status).toBe(200)
  })

  it('uses one code to change password and revoke existing sessions', async () => {
    const { db, post, signIn } = setup()
    const created = await post('/api/account/register', registration)
    const { recoveryCodes } = await created.json() as { recoveryCodes: string[] }
    const signedIn = await signIn('testuser', registration.password)
    expect(signedIn.status).toBe(200)
    const user = db.sqlite.prepare('SELECT id FROM "user" WHERE username=?').get('testuser') as { id: string }
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM "session" WHERE userId=?').get(user.id)).toMatchObject({ count: 1 })
    const reset = await post('/api/account/recover', { username: 'testuser', recoveryCode: recoveryCodes[0], newPassword: 'new-long-test-password' })
    expect(reset.status).toBe(200)
    expect(await reset.json()).toMatchObject({ remainingCodes: 7 })
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM "session" WHERE userId=?').get(user.id)).toMatchObject({ count: 0 })
    expect((await signIn('testuser', registration.password)).status).toBe(401)
    expect((await signIn('testuser', 'new-long-test-password')).status).toBe(200)
    expect((await post('/api/account/recover', { username: 'testuser', recoveryCode: recoveryCodes[0], newPassword: 'third-long-password' })).status).toBe(400)
  })

  it('rotates codes with the current password and invalidates previous codes', async () => {
    const { db, request, post, signIn } = setup()
    const created = await post('/api/account/register', registration)
    const oldCodes = (await created.json() as { recoveryCodes: string[] }).recoveryCodes
    const signedIn = await signIn('testuser', registration.password)
    const cookie = signedIn.headers.get('set-cookie')!.split(';', 1)[0]
    const rotate = (password: string) => request('/api/account/recovery-codes/rotate', { method: 'POST', headers: { origin: base, cookie, 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.10' }, body: JSON.stringify({ password }) })
    expect((await rotate('wrong-password-123')).status).toBe(401)
    const response = await rotate(registration.password)
    expect(response.status).toBe(200)
    const newCodes = (await response.json() as { recoveryCodes: string[] }).recoveryCodes
    expect(newCodes).toHaveLength(8)
    expect(newCodes[0]).not.toBe(oldCodes[0])
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM account_recovery_codes').get()).toMatchObject({ count: 8 })
    expect((await post('/api/account/recover', { username: 'testuser', recoveryCode: oldCodes[0], newPassword: 'new-long-password' })).status).toBe(400)
    expect((await post('/api/account/recover', { username: 'testuser', recoveryCode: newCodes[0], newPassword: 'new-long-password' })).status).toBe(200)
  })

  it('allows only one concurrent reset with the same code', async () => {
    const { post } = setup()
    const created = await post('/api/account/register', registration)
    const code = (await created.json() as { recoveryCodes: string[] }).recoveryCodes[0]
    const attempts = await Promise.all([
      post('/api/account/recover', { username: 'testuser', recoveryCode: code, newPassword: 'one-long-password' }),
      post('/api/account/recover', { username: 'testuser', recoveryCode: code, newPassword: 'two-long-password' }),
    ])
    expect(attempts.map((response) => response.status).sort()).toEqual([200, 400])
  })

  it('rejects direct email signup and cross-origin requests', async () => {
    const { request, post } = setup()
    expect((await request('/api/auth/sign-up/email', { method: 'POST', headers: { origin: base } })).status).toBe(404)
    expect((await request('/api/auth/request-password-reset', { method: 'POST', headers: { origin: base } })).status).toBe(404)
    expect((await post('/api/account/register', registration, 'https://evil.example')).status).toBe(403)
    expect((await post('/api/account/recover', { username: 'testuser', recoveryCode: 'AAAA-AAAA-AAAA-AAAA', newPassword: 'long-test-password' }, 'https://evil.example')).status).toBe(403)
  })

  it('rejects duplicate usernames and limits registration attempts', async () => {
    const { post } = setup()
    expect((await post('/api/account/register', registration)).status).toBe(201)
    expect((await post('/api/account/register', registration)).status).toBe(409)
    expect((await post('/api/account/register', { ...registration, username: 'otheruser' })).status).toBe(201)
    expect((await post('/api/account/register', { ...registration, username: 'thirduser' })).status).toBe(429)
  })
})
