import { Hono } from 'hono'
import { createAuth } from '../auth'
import { digestSecret, normalizeSnapshot, randomDeviceToken, randomPairingCode } from './model'
import { answerBrokerQuestion } from './assistant'

type Bindings = { DB: D1Database; APP_BASE_URL?: string; BETTER_AUTH_SECRET?: string }
type Variables = { ownerId: string; deviceId: string; deviceOwnerId: string }
type BrokerEnv = { Bindings: Bindings; Variables: Variables }

export const ownerBrokerRoutes = new Hono<BrokerEnv>()
export const connectorBrokerRoutes = new Hono<BrokerEnv>()

ownerBrokerRoutes.use('*', async (c, next) => {
  if (!c.env.APP_BASE_URL || !c.env.BETTER_AUTH_SECRET) return c.json({ error: 'Authentication is unavailable.' }, 503)
  if (!c.req.header('cookie')) return c.json({ error: 'Sign in required.' }, 401)
  let userId: string | undefined
  try {
    const session = await createAuth({ DB: c.env.DB, APP_BASE_URL: c.env.APP_BASE_URL, BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET }).api.getSession({ headers: c.req.raw.headers })
    userId = session?.user?.id
  } catch {
    return c.json({ error: 'Session check unavailable.' }, 503)
  }
  if (!userId) return c.json({ error: 'Sign in required.' }, 401)
  const owner = await c.env.DB.prepare("SELECT value FROM app_settings WHERE key='owner_user_id'").bind().first<{ value: string }>()
  if (owner?.value !== userId) return c.json({ error: 'Owner access required.' }, 403)
  if (c.req.method !== 'GET' && c.req.header('origin') !== new URL(c.req.url).origin) return c.json({ error: 'Invalid origin.' }, 403)
  c.set('ownerId', userId)
  await next()
})

ownerBrokerRoutes.post('/pairing-codes', async (c) => {
  const now = Date.now()
  const code = randomPairingCode()
  const expiresAt = now + 10 * 60_000
  const digest = await digestSecret(code)
  await c.env.DB.prepare('UPDATE connector_pairing_codes SET consumed_at=? WHERE owner_id=? AND consumed_at IS NULL').bind(now, c.get('ownerId')).run()
  await c.env.DB.prepare('INSERT INTO connector_pairing_codes(id,owner_id,code_digest,expires_at,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(), c.get('ownerId'), digest, expiresAt, now).run()
  c.header('cache-control', 'no-store')
  return c.json({ code, expiresAt: new Date(expiresAt).toISOString() }, 201)
})

ownerBrokerRoutes.get('/devices', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT d.id,d.name,d.created_at AS createdAt,d.last_seen_at AS lastSeenAt,d.revoked_at AS revokedAt,d.last_state AS lastState,d.last_status_at AS statusAt,a.broker,a.server,a.login,a.environment FROM connector_devices d LEFT JOIN broker_accounts a ON a.device_id=d.id WHERE d.owner_id=? ORDER BY d.created_at DESC LIMIT 50').bind(c.get('ownerId')).all()
  c.header('cache-control', 'no-store')
  return c.json({ devices: results })
})

ownerBrokerRoutes.delete('/devices/:id', async (c) => {
  const device = await c.env.DB.prepare('UPDATE connector_devices SET revoked_at=? WHERE id=? AND owner_id=? AND revoked_at IS NULL RETURNING id').bind(Date.now(), c.req.param('id'), c.get('ownerId')).first()
  if (!device) return c.json({ error: 'Active device not found.' }, 404)
  return c.json({ revoked: true, deviceId: device.id })
})

ownerBrokerRoutes.get('/devices/:id/events', async (c) => {
  const device = await c.env.DB.prepare('SELECT id FROM connector_devices WHERE id=? AND owner_id=?').bind(c.req.param('id'), c.get('ownerId')).first()
  if (!device) return c.json({ error: 'Device not found.' }, 404)
  const { results } = await c.env.DB.prepare('SELECT state,recorded_at AS recordedAt FROM connector_status_events WHERE device_id=? AND owner_id=? ORDER BY id DESC LIMIT 25').bind(c.req.param('id'), c.get('ownerId')).all()
  c.header('cache-control', 'no-store')
  return c.json({ events: results })
})

ownerBrokerRoutes.get('/accounts', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT a.id,a.device_id AS deviceId,a.broker,a.server,a.login,a.environment,a.currency,s.balance,s.equity,s.margin_used AS marginUsed,s.margin_free AS marginFree,s.floating_profit AS floatingProfit,s.positions_json AS positionsJson,s.observed_at AS observedAt,s.received_at AS receivedAt FROM broker_accounts a INNER JOIN connector_devices d ON d.id=a.device_id LEFT JOIN broker_snapshots s ON s.account_id=a.id WHERE a.owner_id=? AND d.revoked_at IS NULL ORDER BY a.updated_at DESC LIMIT 20').bind(c.get('ownerId')).all<{
    id: string; deviceId: string; broker: string; server: string; login: string; environment: string; currency: string; balance: number | null; equity: number | null; marginUsed: number | null; marginFree: number | null; floatingProfit: number | null; positionsJson: string | null; observedAt: string | null; receivedAt: number | null
  }>()
  const now = Date.now()
  const accounts = results.map(({ positionsJson, ...row }) => ({
    ...row,
    positions: positionsJson ? JSON.parse(positionsJson) as unknown[] : [],
    stale: !row.observedAt || now - Date.parse(row.observedAt) > 60_000,
  }))
  c.header('cache-control', 'no-store')
  return c.json({ accounts })
})

ownerBrokerRoutes.post('/accounts/:id/questions', async (c) => {
  const raw = await c.req.text()
  if (raw.length > 1024) return c.json({ error: 'Question exceeds size limit.' }, 413)
  let body: { question?: unknown }
  try { body = JSON.parse(raw) as typeof body } catch { return c.json({ error: 'Invalid JSON.' }, 400) }
  if (typeof body.question !== 'string') return c.json({ error: 'QUESTION_INVALID' }, 400)
  const row = await c.env.DB.prepare('SELECT a.broker,a.server,a.login,a.environment,a.currency,s.balance,s.equity,s.margin_used AS marginUsed,s.margin_free AS marginFree,s.floating_profit AS floatingProfit,s.positions_json AS positionsJson,s.observed_at AS observedAt FROM broker_accounts a INNER JOIN connector_devices d ON d.id=a.device_id AND d.revoked_at IS NULL INNER JOIN broker_snapshots s ON s.account_id=a.id WHERE a.id=? AND a.owner_id=?').bind(c.req.param('id'), c.get('ownerId')).first<{
    broker: string; server: string; login: string; environment: 'DEMO' | 'LIVE'; currency: string; balance: number; equity: number; marginUsed: number | null; marginFree: number | null; floatingProfit: number | null; positionsJson: string; observedAt: string
  }>()
  if (!row) return c.json({ error: 'Account snapshot not found.' }, 404)
  try {
    const answer = answerBrokerQuestion(body.question, {
      observedAt: row.observedAt,
      account: { broker: row.broker, server: row.server, login: row.login, environment: row.environment, currency: row.currency, balance: row.balance, equity: row.equity, marginUsed: row.marginUsed, marginFree: row.marginFree, floatingProfit: row.floatingProfit },
      positions: JSON.parse(row.positionsJson),
    })
    c.header('cache-control', 'no-store')
    return c.json(answer)
  } catch (error) {
    if (error instanceof Error && error.message === 'QUESTION_INVALID') return c.json({ error: 'QUESTION_INVALID' }, 400)
    return c.json({ error: 'Account snapshot unavailable.' }, 503)
  }
})

connectorBrokerRoutes.post('/pair', async (c) => {
  const raw = await c.req.text()
  if (raw.length > 1024) return c.json({ error: 'Pairing request too large.' }, 413)
  let body: { code?: unknown; name?: unknown }
  try { body = JSON.parse(raw) as typeof body } catch { return c.json({ error: 'Invalid JSON.' }, 400) }
  if (typeof body.code !== 'string' || !/^[A-Z2-9]{20}$/.test(body.code) || typeof body.name !== 'string' || !/^[\w .()-]{1,60}$/.test(body.name)) return c.json({ error: 'Invalid pairing request.' }, 400)
  const now = Date.now()
  const ipDigest = await digestSecret(c.req.header('cf-connecting-ip') ?? 'unknown')
  const windowStart = Math.floor(now / 600_000) * 600_000
  const attempt = await c.env.DB.prepare('INSERT INTO connector_pairing_attempts(ip_digest,window_start,attempt_count) VALUES(?,?,1) ON CONFLICT(ip_digest,window_start) DO UPDATE SET attempt_count=attempt_count+1 WHERE attempt_count<10 RETURNING attempt_count').bind(ipDigest, windowStart).first()
  if (!attempt) return c.json({ error: 'Pairing attempts exceeded.' }, 429)
  const digest = await digestSecret(body.code)
  const pairing = await c.env.DB.prepare('UPDATE connector_pairing_codes SET consumed_at=? WHERE code_digest=? AND consumed_at IS NULL AND expires_at>? RETURNING owner_id AS ownerId').bind(now, digest, now).first<{ ownerId: string }>()
  if (!pairing) return c.json({ error: 'Pairing code invalid or expired.' }, 401)
  const token = randomDeviceToken()
  const tokenDigest = await digestSecret(token)
  const deviceId = crypto.randomUUID()
  await c.env.DB.prepare('INSERT INTO connector_devices(id,owner_id,name,token_digest,created_at) VALUES(?,?,?,?,?)').bind(deviceId, pairing.ownerId, body.name, tokenDigest, now).run()
  await c.env.DB.prepare('INSERT INTO connector_status_events(device_id,owner_id,state,recorded_at) VALUES(?,?,?,?)').bind(deviceId, pairing.ownerId, 'PAIRED', now).run()
  c.header('cache-control', 'no-store')
  return c.json({ deviceId, token, scope: 'connector:read-only' }, 201)
})

connectorBrokerRoutes.use('/snapshot', async (c, next) => {
  const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(c.req.header('authorization') ?? '')?.[1]
  if (!token) return c.json({ error: 'Device credential required.' }, 401)
  const digest = await digestSecret(token)
  const device = await c.env.DB.prepare('SELECT id,owner_id AS ownerId FROM connector_devices WHERE token_digest=? AND revoked_at IS NULL').bind(digest).first<{ id: string; ownerId: string }>()
  if (!device) return c.json({ error: 'Device credential invalid or revoked.' }, 401)
  c.set('deviceId', device.id)
  c.set('deviceOwnerId', device.ownerId)
  await next()
})

connectorBrokerRoutes.use('/status', async (c, next) => {
  const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(c.req.header('authorization') ?? '')?.[1]
  if (!token) return c.json({ error: 'Device credential required.' }, 401)
  const digest = await digestSecret(token)
  const device = await c.env.DB.prepare('SELECT id,owner_id AS ownerId FROM connector_devices WHERE token_digest=? AND revoked_at IS NULL').bind(digest).first<{ id: string; ownerId: string }>()
  if (!device) return c.json({ error: 'Device credential invalid or revoked.' }, 401)
  c.set('deviceId', device.id)
  c.set('deviceOwnerId', device.ownerId)
  await next()
})

connectorBrokerRoutes.post('/status', async (c) => {
  const raw = await c.req.text()
  if (raw.length > 128) return c.json({ error: 'Status request too large.' }, 413)
  let body: { state?: unknown }
  try { body = JSON.parse(raw) as typeof body } catch { return c.json({ error: 'Invalid JSON.' }, 400) }
  if (!['MCP_OFFLINE', 'MCP_ERROR', 'PAUSED'].includes(String(body.state))) return c.json({ error: 'Invalid connector state.' }, 400)
  const state = body.state as 'MCP_OFFLINE' | 'MCP_ERROR' | 'PAUSED'
  const now = Date.now()
  const changed = await c.env.DB.prepare('UPDATE connector_devices SET last_state=?,last_status_at=?,last_seen_at=? WHERE id=? AND owner_id=? AND revoked_at IS NULL AND last_state<>? RETURNING id').bind(state, now, now, c.get('deviceId'), c.get('deviceOwnerId'), state).first()
  if (changed) await c.env.DB.prepare('INSERT INTO connector_status_events(device_id,owner_id,state,recorded_at) VALUES(?,?,?,?)').bind(c.get('deviceId'), c.get('deviceOwnerId'), state, now).run()
  else {
    const active = await c.env.DB.prepare('UPDATE connector_devices SET last_status_at=?,last_seen_at=? WHERE id=? AND owner_id=? AND revoked_at IS NULL RETURNING id').bind(now, now, c.get('deviceId'), c.get('deviceOwnerId')).first()
    if (!active) return c.json({ error: 'Device credential invalid or revoked.' }, 401)
  }
  c.header('cache-control', 'no-store')
  return c.json({ state, recordedAt: now })
})

connectorBrokerRoutes.post('/snapshot', async (c) => {
  const raw = await c.req.text()
  if (raw.length > 32_768) return c.json({ error: 'Snapshot exceeds size limit.' }, 413)
  let input: unknown
  try { input = JSON.parse(raw) } catch { return c.json({ error: 'Invalid JSON.' }, 400) }
  let snapshot: ReturnType<typeof normalizeSnapshot>
  try { snapshot = normalizeSnapshot(input, new Date()) } catch (error) { return c.json({ error: error instanceof Error ? error.message : 'SNAPSHOT_INVALID' }, 400) }
  const deviceId = c.get('deviceId')
  const ownerId = c.get('deviceOwnerId')
  const now = Date.now()
  let account = await c.env.DB.prepare('SELECT id,broker,server,login,environment,currency FROM broker_accounts WHERE device_id=? AND owner_id=?').bind(deviceId, ownerId).first<{
    id: string; broker: string; server: string; login: string; environment: string; currency: string
  }>()
  if (!account) {
    await c.env.DB.prepare('INSERT OR IGNORE INTO broker_accounts(id,owner_id,device_id,broker,server,login,environment,currency,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), ownerId, deviceId, snapshot.account.broker, snapshot.account.server, snapshot.account.login, snapshot.account.environment, snapshot.account.currency, now, now).run()
    account = await c.env.DB.prepare('SELECT id,broker,server,login,environment,currency FROM broker_accounts WHERE device_id=? AND owner_id=?').bind(deviceId, ownerId).first<typeof account>()
  }
  if (!account || account.broker !== snapshot.account.broker || account.server !== snapshot.account.server || account.login !== snapshot.account.login || account.environment !== snapshot.account.environment || account.currency !== snapshot.account.currency) return c.json({ error: 'Broker account changed. Re-pair this connector.' }, 409)
  const written = await c.env.DB.prepare('INSERT INTO broker_snapshots(account_id,balance,equity,margin_used,margin_free,floating_profit,positions_json,observed_at,received_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET balance=excluded.balance,equity=excluded.equity,margin_used=excluded.margin_used,margin_free=excluded.margin_free,floating_profit=excluded.floating_profit,positions_json=excluded.positions_json,observed_at=excluded.observed_at,received_at=excluded.received_at WHERE excluded.observed_at>=broker_snapshots.observed_at RETURNING account_id AS accountId').bind(account.id, snapshot.account.balance, snapshot.account.equity, snapshot.account.marginUsed, snapshot.account.marginFree, snapshot.account.floatingProfit, JSON.stringify(snapshot.positions), snapshot.observedAt, now).first<{ accountId: string }>()
  if (!written) return c.json({ error: 'Older broker snapshot rejected.' }, 409)
  await c.env.DB.prepare('UPDATE broker_accounts SET updated_at=? WHERE id=? AND owner_id=?').bind(now, account.id, ownerId).run()
  const changed = await c.env.DB.prepare("UPDATE connector_devices SET last_state='SYNCED',last_status_at=?,last_seen_at=? WHERE id=? AND owner_id=? AND revoked_at IS NULL AND last_state<>'SYNCED' RETURNING id").bind(now, now, deviceId, ownerId).first()
  if (changed) await c.env.DB.prepare('INSERT INTO connector_status_events(device_id,owner_id,state,recorded_at) VALUES(?,?,?,?)').bind(deviceId, ownerId, 'SYNCED', now).run()
  else await c.env.DB.prepare('UPDATE connector_devices SET last_status_at=?,last_seen_at=? WHERE id=? AND owner_id=? AND revoked_at IS NULL').bind(now, now, deviceId, ownerId).run()
  return c.json({ accountId: account.id, environment: account.environment, observedAt: snapshot.observedAt, mode: 'BROKER_READ_ONLY' })
})
