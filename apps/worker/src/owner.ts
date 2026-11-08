import { Hono } from 'hono'
import { createContextClient, verifyAuth } from '@supabase/server/core'
import type { SupabaseEnv } from '@supabase/server'

export type OwnerBindings = {
  SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_KEY?: string
  SUPABASE_JWKS_URL?: string
  SUPABASE_OWNER_USER_ID?: string
}

type OwnerVariables = { ownerId: string; token: string; supabaseEnv: SupabaseEnv }

function configuration(env: OwnerBindings): SupabaseEnv | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_OWNER_USER_ID) return null
  try {
    const url = new URL(env.SUPABASE_URL)
    const jwks = new URL(env.SUPABASE_JWKS_URL ?? `${url.origin}/auth/v1/.well-known/jwks.json`)
    if (url.protocol !== 'https:' || jwks.protocol !== 'https:' || jwks.origin !== url.origin) return null
    return { url: url.origin, publishableKeys: { default: env.SUPABASE_PUBLISHABLE_KEY }, secretKeys: {}, jwks }
  } catch { return null }
}

export function createOwnerRoutes() {
  const routes = new Hono<{ Bindings: OwnerBindings; Variables: OwnerVariables }>()

  routes.get('/config', (c) => {
    const config = configuration(c.env)
    if (!config) return c.json({ error: 'Owner access is not configured.' }, 503)
    return c.json({ url: config.url, publishableKey: config.publishableKeys.default })
  })

  routes.use('*', async (c, next) => {
    const config = configuration(c.env)
    if (!config) return c.json({ error: 'Owner access is not configured.' }, 503)
    const { data, error } = await verifyAuth(c.req.raw, {
      auth: 'user',
      audience: 'authenticated',
      issuer: `${config.url}/auth/v1`,
      env: config,
    })
    if (error || !data?.userClaims?.id) return c.json({ error: 'Authentication required.' }, 401)
    if (data.userClaims.id !== c.env.SUPABASE_OWNER_USER_ID || data.userClaims.role !== 'authenticated') {
      return c.json({ error: 'Owner access required.' }, 403)
    }
    if (c.req.path !== '/api/owner/session' && data.jwtClaims?.aal !== 'aal2') {
      return c.json({ error: 'Authenticator verification required.' }, 403)
    }
    c.set('ownerId', data.userClaims.id)
    c.set('token', data.token!)
    c.set('supabaseEnv', config)
    await next()
  })

  routes.get('/session', (c) => c.json({ userId: c.get('ownerId'), role: 'owner' }))

  routes.get('/workspace', async (c) => {
    const client = createContextClient({ auth: { token: c.get('token') }, env: c.get('supabaseEnv') })
    const { data, error } = await client.from('owner_workspace').select('workspace_name,updated_at').eq('owner_id', c.get('ownerId')).maybeSingle()
    if (error) return c.json({ error: 'Could not load owner workspace.' }, 503)
    return c.json({ workspaceName: data?.workspace_name ?? 'TradeRelayCity', updatedAt: data?.updated_at ?? null })
  })

  routes.put('/workspace', async (c) => {
    if (c.req.header('origin') !== new URL(c.req.url).origin) return c.json({ error: 'Invalid origin.' }, 403)
    if (!c.req.header('content-type')?.startsWith('application/json')) return c.json({ error: 'JSON required.' }, 415)
    const raw = await c.req.text()
    if (raw.length > 1024) return c.json({ error: 'Payload too large.' }, 413)
    let body: { workspaceName?: unknown }
    try { body = JSON.parse(raw) as typeof body } catch { return c.json({ error: 'Invalid JSON.' }, 400) }
    const name = typeof body.workspaceName === 'string' ? body.workspaceName.trim() : ''
    if (!name || name.length > 80) return c.json({ error: 'Workspace name must be 1 to 80 characters.' }, 400)
    const client = createContextClient({ auth: { token: c.get('token') }, env: c.get('supabaseEnv') })
    const { data, error } = await client.from('owner_workspace').upsert({ owner_id: c.get('ownerId'), workspace_name: name }, { onConflict: 'owner_id' }).select('workspace_name,updated_at').single()
    if (error) return c.json({ error: 'Could not save owner workspace.' }, 503)
    return c.json({ workspaceName: data.workspace_name, updatedAt: data.updated_at })
  })

  return routes
}
