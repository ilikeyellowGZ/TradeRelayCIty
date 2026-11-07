import { Hono } from 'hono'
import { createSimulationState, SimulationAccessError, type SimulationCommandStatus } from './simulation/core'
import { createAuth } from './auth'
import { MockAiProvider, type AiCandidate } from './ai/provider'
import { registerHistoryRoutes } from './history/routes'
import { answerSimulationQuestion, normalizeChatQuestion, type ChatContext } from './chat/simulation'
import { listHistory, type HistoryDatabase } from './history/repository'

type Bindings = { DB: D1Database; SIMULATION_MODE?: string; APP_BASE_URL?: string; BETTER_AUTH_SECRET?: string }
type Variables = { simulationUser: string }
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()
const fixture = createSimulationState()
const allowedUsers = new Set(fixture.users.map((user) => user.id))
const statuses: SimulationCommandStatus[] = ['pending', 'claimed', 'submitting', 'filled', 'partially_filled', 'rejected', 'expired', 'cancelled', 'unknown']
const allowedTransitions: Record<SimulationCommandStatus, SimulationCommandStatus[]> = {
  pending: ['claimed', 'expired', 'cancelled'], claimed: ['submitting', 'expired', 'cancelled', 'unknown'],
  submitting: ['filled', 'partially_filled', 'rejected', 'unknown'], filled: [], partially_filled: ['filled', 'unknown'],
  rejected: [], expired: [], cancelled: [], unknown: ['filled', 'partially_filled', 'rejected', 'cancelled'],
}

app.get('/api/health', (c) => c.json({ status: 'ok', service: 'TradeRelayCity', mode: 'SIMULATED', isLive: false }))

app.on(['GET', 'POST'], '/api/auth/*', (c) => {
  if (!c.env.APP_BASE_URL || !c.env.BETTER_AUTH_SECRET) return c.json({ error: 'Authentication is not configured.' }, 503)
  return createAuth({ DB: c.env.DB, APP_BASE_URL: c.env.APP_BASE_URL, BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET }).handler(c.req.raw)
})

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

app.get('/api/invitations/validate', async (c) => {
  const token = c.req.query('token')
  if (!token || token.length > 512) return c.json({ valid: false }, 400)
  const row = await c.env.DB.prepare("SELECT display_name AS displayName, expires_at AS expiresAt FROM invitations WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > datetime('now') LIMIT 1").bind(await sha256(token)).first<{ displayName: string; expiresAt: string }>()
  return c.json(row ? { valid: true, displayName: row.displayName, expiresAt: row.expiresAt } : { valid: false }, row ? 200 : 404)
})

app.post('/api/invitations', async (c) => {
  if (!c.env.APP_BASE_URL || !c.env.BETTER_AUTH_SECRET) return c.json({ error: 'Authentication is not configured.' }, 503)
  if (c.req.header('origin') !== c.env.APP_BASE_URL) return c.json({ error: 'Invalid origin.' }, 403)
  const auth = createAuth({ DB: c.env.DB, APP_BASE_URL: c.env.APP_BASE_URL, BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET })
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) return c.json({ error: 'Authentication required.' }, 401)
  const owner = await c.env.DB.prepare("SELECT value FROM app_settings WHERE key = 'owner_user_id'").first<{ value: string }>()
  if (!owner || owner.value !== session.user.id) return c.json({ error: 'Owner access required.' }, 403)
  const recent = await c.env.DB.prepare("SELECT COUNT(*) AS count FROM invitations WHERE created_by = ? AND created_at > datetime('now', '-1 hour')").bind(session.user.id).first<{ count: number }>()
  if ((recent?.count ?? 0) >= 10) return c.json({ error: 'Invitation rate limit reached.' }, 429)
  const body = await c.req.json<{ email?: string; displayName?: string }>().catch(() => ({}))
  const email = body.email?.trim().toLowerCase()
  const displayName = body.displayName?.trim()
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !displayName || displayName.length > 80) return c.json({ error: 'A valid email and display name are required.' }, 400)
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const token = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
  const inviteId = crypto.randomUUID()
  const userId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  await c.env.DB.prepare('INSERT INTO invitations(id,user_id,email,display_name,role,token_hash,expires_at,created_by) VALUES(?,?,?,?,?,?,?,?)').bind(inviteId, userId, email, displayName, 'member', await sha256(token), expiresAt, session.user.id).run()
  return c.json({ invitationUrl: `${c.env.APP_BASE_URL}/enroll?token=${encodeURIComponent(token)}`, expiresAt }, 201)
})

app.use('/api/simulation/*', async (c, next) => {
  const host = new URL(c.req.url).hostname
  if (c.env.SIMULATION_MODE !== 'true' || !['localhost', '127.0.0.1', '::1'].includes(host)) return c.notFound()
  const userId = c.req.header('x-simulation-user') ?? 'sim-owner'
  if (!allowedUsers.has(userId)) return c.json({ error: 'Unknown simulation persona' }, 401)
  c.set('simulationUser', userId)
  await next()
})

app.use('/api/simulation/chat', async (c, next) => {
  if (c.req.method !== 'GET' && c.req.header('origin') !== new URL(c.req.url).origin) return c.json({ error: 'Invalid origin.' }, 403)
  await c.env.DB.prepare("DELETE FROM sim_chat_conversations WHERE owner_id = ? AND expires_at <= datetime('now')").bind(c.get('simulationUser')).run()
  await next()
})
app.use('/api/simulation/chat/*', async (c, next) => {
  if (c.req.method !== 'GET' && c.req.header('origin') !== new URL(c.req.url).origin) return c.json({ error: 'Invalid origin.' }, 403)
  await c.env.DB.prepare("DELETE FROM sim_chat_conversations WHERE owner_id = ? AND expires_at <= datetime('now')").bind(c.get('simulationUser')).run()
  await next()
})

app.get('/api/simulation/session', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, display_name AS name, role FROM sim_users ORDER BY id').all<{ id: string; name: string; role: 'owner' | 'member' }>()
  return c.json({ persona: results.find((user) => user.id === c.get('simulationUser')), users: results, mode: 'SIMULATED', isLive: false })
})

app.get('/api/simulation/chat', async (c) => {
  const accountId = c.req.query('accountId')
  if (!accountId || accountId.length > 100) return c.json({ error: 'A bounded accountId is required.' }, 400)
  const ownerId = c.get('simulationUser')
  const account = await c.env.DB.prepare('SELECT id FROM sim_accounts WHERE id = ? AND owner_id = ?').bind(accountId, ownerId).first()
  if (!account) return c.json({ error: 'Account not found.' }, 404)
  const { results } = await c.env.DB.prepare('SELECT id, account_id AS accountId, title, created_at AS createdAt, updated_at AS updatedAt, expires_at AS expiresAt FROM sim_chat_conversations WHERE owner_id = ? AND account_id = ? ORDER BY updated_at DESC LIMIT 50').bind(ownerId, accountId).all()
  return c.json({ conversations: results, mode: 'SIMULATED', retentionDays: 90 })
})

app.post('/api/simulation/chat', async (c) => {
  const body = await c.req.json<{ accountId?: string; title?: string }>().catch(() => ({}))
  if (!body.accountId || body.accountId.length > 100) return c.json({ error: 'A bounded accountId is required.' }, 400)
  const ownerId = c.get('simulationUser')
  const account = await c.env.DB.prepare('SELECT id FROM sim_accounts WHERE id = ? AND owner_id = ?').bind(body.accountId, ownerId).first()
  if (!account) return c.json({ error: 'Account not found.' }, 404)
  const id = crypto.randomUUID()
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 80) : 'New conversation'
  await c.env.DB.prepare('INSERT INTO sim_chat_conversations(id, owner_id, account_id, title) VALUES(?,?,?,?)').bind(id, ownerId, body.accountId, title || 'New conversation').run()
  return c.json({ conversation: { id, accountId: body.accountId, title: title || 'New conversation', messages: [], expiresAt: new Date(Date.now() + 90 * 86400000).toISOString() }, mode: 'SIMULATED' }, 201)
})

app.get('/api/simulation/chat/:id', async (c) => {
  const ownerId = c.get('simulationUser')
  const conversation = await c.env.DB.prepare("SELECT id, account_id AS accountId, title, created_at AS createdAt, updated_at AS updatedAt, expires_at AS expiresAt FROM sim_chat_conversations WHERE id = ? AND owner_id = ? AND expires_at > datetime('now')").bind(c.req.param('id'), ownerId).first<Record<string, unknown>>()
  if (!conversation) return c.json({ error: 'Conversation not found.' }, 404)
  const { results } = await c.env.DB.prepare("SELECT id, role, content, citations_json AS citationsJson, created_at AS createdAt FROM sim_chat_messages WHERE conversation_id = ? ORDER BY created_at LIMIT 100").bind(conversation.id).all<{ id: string; role: string; content: string; citationsJson: string; createdAt: string }>()
  const messages = results.map(({ citationsJson, ...message }) => ({ ...message, citations: JSON.parse(citationsJson) as string[] }))
  return c.json({ conversation: { ...conversation, messages }, mode: 'SIMULATED' })
})

app.delete('/api/simulation/chat/:id', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM sim_chat_conversations WHERE id = ? AND owner_id = ? RETURNING id').bind(c.req.param('id'), c.get('simulationUser')).first()
  if (!result) return c.json({ error: 'Conversation not found.' }, 404)
  return c.json({ deleted: true })
})

app.post('/api/simulation/chat/:id/messages', async (c) => {
  const rawBody = await c.req.text()
  if (rawBody.length > 7000) return c.json({ error: 'Message payload exceeds the 7 KB limit.' }, 413)
  let body: { content?: unknown }
  try { body = JSON.parse(rawBody) as typeof body } catch { return c.json({ error: 'Invalid JSON request.' }, 400) }
  const question = normalizeChatQuestion(body.content)
  if (!question) return c.json({ error: 'A message from 1 to 2,000 characters is required.' }, 400)
  const ownerId = c.get('simulationUser')
  const conversation = await c.env.DB.prepare("SELECT id, account_id AS accountId FROM sim_chat_conversations WHERE id = ? AND owner_id = ? AND expires_at > datetime('now')").bind(c.req.param('id'), ownerId).first<{ id: string; accountId: string }>()
  if (!conversation) return c.json({ error: 'Conversation not found.' }, 404)
  const messageCount = await c.env.DB.prepare('SELECT COUNT(*) AS count FROM sim_chat_messages WHERE conversation_id = ?').bind(conversation.id).first<{ count: number }>()
  if ((messageCount?.count ?? 0) >= 100) return c.json({ error: 'This conversation reached its 100-message limit. Start a new conversation to continue.' }, 409)
  const usageRow = await c.env.DB.prepare("INSERT INTO sim_chat_usage_daily(user_id, usage_date, request_count, daily_limit) VALUES(?, date('now'), 1, 20) ON CONFLICT(user_id, usage_date) DO UPDATE SET request_count = sim_chat_usage_daily.request_count + 1 WHERE sim_chat_usage_daily.request_count < sim_chat_usage_daily.daily_limit RETURNING request_count AS used, daily_limit AS dailyLimit").bind(ownerId).first<{ used: number; dailyLimit: number }>()
  const usage = usageRow ? { used: usageRow.used, limit: usageRow.dailyLimit } : null
  if (!usage) return c.json({ error: 'SIMULATED chat allowance reached for today.', code: 'CHAT_QUOTA_EXHAUSTED' }, 429)
  const [account, positions, commands, decision, history] = await Promise.all([
    c.env.DB.prepare('SELECT id, owner_id, label, currency, balance, equity, daily_pnl, connected FROM sim_accounts WHERE id = ? AND owner_id = ?').bind(conversation.accountId, ownerId).first<ChatContext['account']>(),
    c.env.DB.prepare('SELECT p.id, p.symbol, p.side, p.volume, p.pnl FROM sim_positions p INNER JOIN sim_accounts a ON a.id = p.account_id WHERE p.account_id = ? AND a.owner_id = ? ORDER BY p.id LIMIT 20').bind(conversation.accountId, ownerId).all<ChatContext['positions'][number]>(),
    c.env.DB.prepare("SELECT id, operation, symbol, status, note, expires_at FROM sim_commands WHERE account_id = ? AND owner_id = ? ORDER BY created_at DESC LIMIT 20").bind(conversation.accountId, ownerId).all<ChatContext['commands'][number]>(),
    c.env.DB.prepare('SELECT id, decision, rationale FROM sim_decisions WHERE owner_id = ? ORDER BY created_at DESC LIMIT 1').bind(ownerId).first<NonNullable<ChatContext['decision']>>(),
    listHistory(c.env.DB as HistoryDatabase, ownerId, conversation.accountId, { limit: 25, environment: 'SIMULATED' }),
  ])
  if (!account) return c.json({ error: 'Account not found.' }, 404)
  const context: ChatContext = { account, positions: positions.results, commands: commands.results, decision: decision ?? null, usage, history: history.items }
  const answer = answerSimulationQuestion(question, context)
  const userMessage = { id: crypto.randomUUID(), role: 'user', content: question, citations: [], createdAt: new Date().toISOString() }
  const assistantMessage = { id: crypto.randomUUID(), role: 'assistant', content: answer.content, citations: answer.citations, createdAt: new Date().toISOString(), simulated: true as const }
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO sim_chat_messages(id, conversation_id, role, content, citations_json, created_at) VALUES(?,?,?,?,?,?)').bind(userMessage.id, conversation.id, userMessage.role, userMessage.content, '[]', userMessage.createdAt),
    c.env.DB.prepare('INSERT INTO sim_chat_messages(id, conversation_id, role, content, citations_json, created_at) VALUES(?,?,?,?,?,?)').bind(assistantMessage.id, conversation.id, assistantMessage.role, assistantMessage.content, JSON.stringify(assistantMessage.citations), assistantMessage.createdAt),
    c.env.DB.prepare("UPDATE sim_chat_conversations SET updated_at = datetime('now'), title = CASE WHEN title = 'New conversation' THEN ? ELSE title END WHERE id = ? AND owner_id = ?").bind(question.slice(0, 80), conversation.id, ownerId),
  ])
  return c.json({ messages: [userMessage, assistantMessage], usage, mode: 'SIMULATED', provider: 'deterministic-fixture' })
})

app.get('/api/simulation/accounts', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, owner_id AS ownerId, label, broker, server, login, environment, mode, 0 AS isLive, currency, balance, equity, daily_pnl AS dailyPnl, connected FROM sim_accounts WHERE owner_id = ? ORDER BY id').bind(c.get('simulationUser')).all()
  return c.json({ accounts: results })
})

app.get('/api/simulation/accounts/:id/overview', async (c) => {
  const account = await c.env.DB.prepare('SELECT id, owner_id AS ownerId, label, broker, server, login, environment, mode, 0 AS isLive, currency, balance, equity, daily_pnl AS dailyPnl, connected FROM sim_accounts WHERE id = ? AND owner_id = ?').bind(c.req.param('id'), c.get('simulationUser')).first<Record<string, unknown>>()
  if (!account) return c.json({ error: 'Account not found' }, 404)
  const [positions, commands, latestDecision, events] = await Promise.all([
    c.env.DB.prepare('SELECT id, account_id AS accountId, symbol, description, side, volume, entry, market, pnl, source FROM sim_positions WHERE account_id = ? ORDER BY id').bind(account.id).all(),
    c.env.DB.prepare('SELECT id, account_id AS accountId, owner_id AS ownerId, operation, symbol, status, note, expires_at AS expiresAt, attempts FROM sim_commands WHERE account_id = ? ORDER BY created_at DESC').bind(account.id).all(),
    c.env.DB.prepare('SELECT id, owner_id AS ownerId, decision, rationale FROM sim_decisions WHERE owner_id = ? ORDER BY created_at DESC LIMIT 1').bind(c.get('simulationUser')).first(),
    c.env.DB.prepare('SELECT id, kind, message FROM sim_events WHERE owner_id = ? ORDER BY created_at DESC LIMIT 10').bind(c.get('simulationUser')).all(),
  ])
  return c.json({ ...account, isLive: false, balance: { amount: account.balance, currency: account.currency }, positions: positions.results, commands: commands.results, latestDecision, events: events.results })
})

registerHistoryRoutes(app)

app.post('/api/simulation/ai/decision', async (c) => {
  const rawBody = await c.req.text()
  if (rawBody.length > 8192) return c.json({ error: 'Snapshot payload exceeds the 8 KB local limit.' }, 413)
  let body: { snapshotId?: string; candidate?: AiCandidate | null }
  try { body = JSON.parse(rawBody) as typeof body } catch { return c.json({ error: 'Invalid JSON request.' }, 400) }
  if (!body.snapshotId || !/^[a-zA-Z0-9._:-]{1,100}$/.test(body.snapshotId)) return c.json({ error: 'A bounded snapshotId is required.' }, 400)
  const candidate = body.candidate ?? null
  if (candidate && (!/^[A-Z0-9._-]{1,20}$/.test(candidate.symbol) || !['BUY', 'SELL'].includes(candidate.direction) || ![candidate.entry, candidate.stop, candidate.target].every((value) => Number.isFinite(value) && Math.abs(value) < 1e12) || !/^\d+\.\d+\.\d+$/.test(candidate.strategyVersion))) return c.json({ error: 'Candidate schema is invalid.' }, 400)
  const userId = c.get('simulationUser')
  const quota = await c.env.DB.prepare("INSERT INTO ai_usage_daily(user_id,owner_id,usage_date,request_count,token_count,user_limit,owner_limit) SELECT ?, 'sim-owner', date('now'), 1, 0, ?, 30 WHERE ? > 0 AND (SELECT COALESCE(SUM(request_count),0) FROM ai_usage_daily WHERE owner_id = 'sim-owner' AND usage_date = date('now')) < 30 ON CONFLICT(user_id,usage_date) DO UPDATE SET request_count = ai_usage_daily.request_count + 1 WHERE ai_usage_daily.request_count < ai_usage_daily.user_limit AND (SELECT COALESCE(SUM(request_count),0) FROM ai_usage_daily WHERE owner_id = 'sim-owner' AND usage_date = date('now')) < ai_usage_daily.owner_limit RETURNING request_count AS requestCount, user_limit AS userLimit, owner_limit AS ownerLimit").bind(userId, userId === 'sim-trader-2' ? 0 : 10, userId === 'sim-trader-2' ? 0 : 10).first<{ requestCount: number; userLimit: number; ownerLimit: number }>()
  if (!quota) return c.json({ error: 'SIMULATED AI daily quota reached.', code: 'AI_QUOTA_EXHAUSTED', provider: 'mock', isLive: false }, 429)
  const decision = await new MockAiProvider().decide({ snapshotId: body.snapshotId, candidate })
  await c.env.DB.prepare('INSERT INTO sim_decisions(id,owner_id,decision,rationale) VALUES(?,?,?,?)').bind(decision.decisionId, userId, decision.decision, decision.rationale).run()
  return c.json({ ...decision, provider: 'mock', usage: { requestCount: quota.requestCount, userLimit: quota.userLimit, ownerLimit: quota.ownerLimit }, mode: 'SIMULATED', isLive: false })
})

app.post('/api/simulation/connector/poll', async (c) => {
  const body = await c.req.json<{ accountId?: string }>().catch(() => ({}))
  if (!body.accountId || body.accountId.length > 100) return c.json({ error: 'An accountId is required.' }, 400)
  const account = await c.env.DB.prepare('SELECT id FROM sim_accounts WHERE id = ? AND owner_id = ?').bind(body.accountId, c.get('simulationUser')).first<{ id: string }>()
  if (!account) return c.json({ error: 'Account not found.' }, 404)
  const command = await c.env.DB.prepare("UPDATE sim_commands SET status = 'claimed' WHERE id = (SELECT id FROM sim_commands WHERE account_id = ? AND owner_id = ? AND operation = 'HOLD' AND status = 'pending' AND expires_at > datetime('now') ORDER BY created_at LIMIT 1) AND account_id = ? AND owner_id = ? AND operation = 'HOLD' AND status = 'pending' AND expires_at > datetime('now') RETURNING id, account_id AS accountId, operation, symbol, status, note, expires_at AS expiresAt, idempotency_key AS idempotencyKey").bind(account.id, c.get('simulationUser'), account.id, c.get('simulationUser')).first()
  return c.json({ command: command ?? null, mode: 'SIMULATED', isLive: false, brokerAction: 'NONE' })
})

app.post('/api/simulation/connector/:id/ack', async (c) => {
  const command = await c.env.DB.prepare("UPDATE sim_commands SET status = 'cancelled', note = 'SIMULATION_ONLY_NO_BROKER_ACTION' WHERE id = ? AND owner_id = ? AND operation = 'HOLD' AND status = 'claimed' AND expires_at > datetime('now') RETURNING id, account_id AS accountId, status, operation, note").bind(c.req.param('id'), c.get('simulationUser')).first()
  if (!command) return c.json({ error: 'Claimed HOLD command not found or expired.' }, 404)
  return c.json({ command, mode: 'SIMULATED', isLive: false, brokerAction: 'NONE', acknowledged: true })
})

app.post('/api/simulation/commands/:id/transition', async (c) => {
  const body = await c.req.json<{ status?: SimulationCommandStatus }>().catch(() => ({}))
  if (!body.status || !statuses.includes(body.status)) return c.json({ error: 'Invalid command status' }, 400)
  const command = await c.env.DB.prepare('SELECT id, owner_id AS ownerId, status, expires_at AS expiresAt FROM sim_commands WHERE id = ? AND owner_id = ?').bind(c.req.param('id'), c.get('simulationUser')).first<{ id: string; ownerId: string; status: SimulationCommandStatus; expiresAt: string }>()
  if (!command) return c.json({ error: 'Command not found' }, 404)
  if (command.status === body.status) return c.json({ command })
  if (!allowedTransitions[command.status].includes(body.status)) return c.json({ error: `Invalid command transition: ${command.status} -> ${body.status}` }, 409)
  if (new Date(command.expiresAt).getTime() <= Date.now() && ['claimed', 'submitting'].includes(body.status)) return c.json({ error: 'Expired command cannot be claimed or submitted.' }, 409)
  const changed = await c.env.DB.prepare('UPDATE sim_commands SET status = ?, attempts = attempts + ? WHERE id = ? AND owner_id = ? AND status = ? RETURNING id, owner_id AS ownerId, account_id AS accountId, status, operation, symbol, attempts').bind(body.status, body.status === 'submitting' ? 1 : 0, command.id, c.get('simulationUser'), command.status).first()
  if (!changed) return c.json({ error: 'Command changed concurrently; refresh and retry.' }, 409)
  return c.json({ command: changed })
})

app.get('/api/*', (c) => c.json({ error: 'Not found' }, 404))

export default app
