import { Hono } from 'hono'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { createAuth } from './auth'

type Bindings = { DB: D1Database; BETTER_AUTH_SECRET?: string; APP_BASE_URL?: string }
export const publicAccountRoutes = new Hono<{ Bindings: Bindings }>()

const codeCount = 8
const codeBytes = 16
const usernamePattern = /^[a-zA-Z0-9_.]{3,30}$/
const recoveryCodePattern = /^[0-9A-F]{8}(?:-[0-9A-F]{8}){3}$/

function sameOrigin(request: Request): boolean {
  return request.headers.get('origin') === new URL(request.url).origin
}

async function body(request: Request): Promise<Record<string, unknown> | null> {
  const raw = await request.text()
  if (raw.length > 4096) return null
  try {
    const value: unknown = JSON.parse(raw)
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  } catch { return null }
}

async function digest(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function newRecoveryCode(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(codeBytes)), (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
  return hex.match(/.{8}/g)!.join('-')
}

async function limited(db: D1Database, secret: string, category: string, identity: string, max: number, windowMs: number): Promise<boolean> {
  const key = `public:${await digest(secret, `${category}:${identity}`)}`
  const now = Date.now()
  const row = await db.prepare('INSERT INTO "rateLimit" (id,"key","count","lastRequest") VALUES(?,?,1,?) ON CONFLICT("key") DO UPDATE SET "count"=CASE WHEN "lastRequest"<? THEN 1 ELSE "count"+1 END,"lastRequest"=? RETURNING "count"')
    .bind(crypto.randomUUID(), key, now, now - windowMs, now).first<{ count: number }>()
  return (row?.count ?? max + 1) > max
}

publicAccountRoutes.post('/register', async (c) => {
  c.header('cache-control', 'no-store')
  if (!sameOrigin(c.req.raw)) return c.json({ error: 'Invalid origin.' }, 403)
  const secret = c.env.BETTER_AUTH_SECRET
  if (!secret || !c.env.APP_BASE_URL) return c.json({ error: 'Account service is unavailable.' }, 503)
  const input = await body(c.req.raw)
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  const username = typeof input?.username === 'string' ? input.username.trim().toLowerCase() : ''
  const password = typeof input?.password === 'string' ? input.password : ''
  if (!name || name.length > 100 || !usernamePattern.test(username) || password.length < 12 || password.length > 128) return c.json({ error: 'Enter a name, a valid username, and a password of 12 to 128 characters.' }, 400)
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown'
  if (await limited(c.env.DB, secret, 'register', ip, 3, 60 * 60 * 1000)) return c.json({ error: 'Too many attempts. Try again later.' }, 429)
  if (await c.env.DB.prepare('SELECT id FROM "user" WHERE username=?').bind(username).first()) return c.json({ error: 'Username unavailable.' }, 409)

  const userId = crypto.randomUUID()
  const now = Date.now()
  const codes = Array.from({ length: codeCount }, newRecoveryCode)
  const hashes = await Promise.all(codes.map((code) => digest(secret, `${userId}:${code}`)))
  const passwordHash = await hashPassword(password)
  const statements = [
    c.env.DB.prepare('INSERT INTO "user" (id,name,email,emailVerified,createdAt,updatedAt,username) VALUES(?,?,?,?,?,?,?)')
      .bind(userId, name, `account-${userId}@accounts.traderelaycity.invalid`, 0, now, now, username),
    c.env.DB.prepare('INSERT INTO "account" (id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(), userId, 'credential', userId, passwordHash, now, now),
    ...hashes.map((hash) => c.env.DB.prepare('INSERT INTO account_recovery_codes(id,user_id,code_hash,created_at) VALUES(?,?,?,?)')
      .bind(crypto.randomUUID(), userId, hash, now)),
  ]
  try { await c.env.DB.batch(statements) }
  catch { return c.json({ error: 'Could not create your account. Try again shortly.' }, 503) }
  return c.json({ username, recoveryCodes: codes }, 201)
})

publicAccountRoutes.post('/recover', async (c) => {
  c.header('cache-control', 'no-store')
  if (!sameOrigin(c.req.raw)) return c.json({ error: 'Invalid origin.' }, 403)
  const secret = c.env.BETTER_AUTH_SECRET
  if (!secret || !c.env.APP_BASE_URL) return c.json({ error: 'Account service is unavailable.' }, 503)
  const input = await body(c.req.raw)
  const username = typeof input?.username === 'string' ? input.username.trim().toLowerCase() : ''
  const code = typeof input?.recoveryCode === 'string' ? input.recoveryCode.trim().toUpperCase() : ''
  const password = typeof input?.newPassword === 'string' ? input.newPassword : ''
  if (!usernamePattern.test(username) || !recoveryCodePattern.test(code) || password.length < 12 || password.length > 128) return c.json({ error: 'Enter your username, a recovery code, and a new password of 12 to 128 characters.' }, 400)
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown'
  if (await limited(c.env.DB, secret, 'recover', `${ip}:${username}`, 5, 15 * 60 * 1000)) return c.json({ error: 'Too many attempts. Try again later.' }, 429)
  const user = await c.env.DB.prepare('SELECT id FROM "user" WHERE username=?').bind(username).first<{ id: string }>()
  if (!user) return c.json({ error: 'Invalid username or recovery code.' }, 400)
  const codeHash = await digest(secret, `${user.id}:${code}`)
  const codeRow = await c.env.DB.prepare('SELECT id FROM account_recovery_codes WHERE user_id=? AND code_hash=? AND used_at IS NULL').bind(user.id, codeHash).first()
  if (!codeRow) return c.json({ error: 'Invalid username or recovery code.' }, 400)
  const passwordHash = await hashPassword(password)
  const unused = 'EXISTS (SELECT 1 FROM account_recovery_codes WHERE user_id=? AND code_hash=? AND used_at IS NULL)'
  const now = Date.now()
  const [updated] = await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE "account" SET password=?,updatedAt=? WHERE userId=? AND providerId='credential' AND ${unused} RETURNING userId`).bind(passwordHash, now, user.id, user.id, codeHash),
    c.env.DB.prepare(`DELETE FROM "session" WHERE userId=? AND ${unused}`).bind(user.id, user.id, codeHash),
    c.env.DB.prepare('UPDATE account_recovery_codes SET used_at=? WHERE user_id=? AND code_hash=? AND used_at IS NULL').bind(now, user.id, codeHash),
  ])
  if (!updated.results?.length) return c.json({ error: 'Invalid username or recovery code.' }, 400)
  return c.json({ ok: true, remainingCodes: await c.env.DB.prepare('SELECT COUNT(*) AS count FROM account_recovery_codes WHERE user_id=? AND used_at IS NULL').bind(user.id).first<{ count: number }>().then((row) => row?.count ?? 0) })
})

publicAccountRoutes.post('/recovery-codes/rotate', async (c) => {
  c.header('cache-control', 'no-store')
  if (!sameOrigin(c.req.raw)) return c.json({ error: 'Invalid origin.' }, 403)
  const secret = c.env.BETTER_AUTH_SECRET
  const baseURL = c.env.APP_BASE_URL
  if (!secret || !baseURL) return c.json({ error: 'Account service is unavailable.' }, 503)
  const session = await createAuth({ DB: c.env.DB, APP_BASE_URL: baseURL, BETTER_AUTH_SECRET: secret }).api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) return c.json({ error: 'Sign in to manage recovery codes.' }, 401)
  const input = await body(c.req.raw)
  const password = typeof input?.password === 'string' ? input.password : ''
  if (password.length < 12 || password.length > 128) return c.json({ error: 'Enter your current password.' }, 400)
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown'
  if (await limited(c.env.DB, secret, 'rotate', `${ip}:${session.user.id}`, 5, 60 * 60 * 1000)) return c.json({ error: 'Too many attempts. Try again later.' }, 429)
  const account = await c.env.DB.prepare("SELECT password FROM \"account\" WHERE userId=? AND providerId='credential'").bind(session.user.id).first<{ password: string }>()
  if (!account?.password || !(await verifyPassword({ hash: account.password, password }))) return c.json({ error: 'Current password is incorrect.' }, 401)
  const codes = Array.from({ length: codeCount }, newRecoveryCode)
  const hashes = await Promise.all(codes.map((code) => digest(secret, `${session.user.id}:${code}`)))
  const now = Date.now()
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM account_recovery_codes WHERE user_id=?').bind(session.user.id),
    ...hashes.map((hash) => c.env.DB.prepare('INSERT INTO account_recovery_codes(id,user_id,code_hash,created_at) VALUES(?,?,?,?)').bind(crypto.randomUUID(), session.user.id, hash, now)),
  ])
  return c.json({ recoveryCodes: codes })
})
