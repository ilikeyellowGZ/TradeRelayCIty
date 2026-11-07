import { betterAuth } from 'better-auth'
import { passkey } from '@better-auth/passkey'

export type AuthEnv = {
  DB: D1Database
  APP_BASE_URL: string
  BETTER_AUTH_SECRET: string
}

async function inviteHash(raw: string) {
  const bytes = new TextEncoder().encode(raw)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function createAuth(env: AuthEnv) {
  const baseURL = new URL(env.APP_BASE_URL)
  return betterAuth({
    database: env.DB,
    baseURL: env.APP_BASE_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_BASE_URL],
    emailAndPassword: { enabled: false },
    plugins: [passkey({
      rpID: baseURL.hostname,
      rpName: 'TradeRelayCity',
      origin: [env.APP_BASE_URL],
      authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' },
      registration: {
        requireSession: false,
        resolveUser: async ({ context, ctx }) => {
          if (!context || context.length > 512) throw new Error('Invitation is invalid or expired.')
          const tokenHash = await inviteHash(context)
          const invitation = await env.DB.prepare("SELECT id, user_id AS userId, email, display_name AS displayName FROM invitations WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > datetime('now') LIMIT 1").bind(tokenHash).first<{ id: string; userId: string; email: string; displayName: string }>()
          if (!invitation) throw new Error('Invitation is invalid or expired.')
          const existing = await ctx.context.internalAdapter.findUserById(invitation.userId)
          if (!existing) await ctx.context.internalAdapter.createUser({ id: invitation.userId, name: invitation.displayName, email: invitation.email, emailVerified: false })
          return { id: invitation.userId, name: invitation.displayName }
        },
        afterVerification: async ({ context }) => {
          if (!context) throw new Error('Invitation is invalid or expired.')
          const tokenHash = await inviteHash(context)
          const invitation = await env.DB.prepare("UPDATE invitations SET consumed_at = datetime('now') WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > datetime('now') RETURNING user_id AS userId, role").bind(tokenHash).first<{ userId: string; role: 'owner' | 'member' }>()
          if (!invitation) throw new Error('Invitation was already consumed or has expired.')
          if (invitation.role === 'owner') await env.DB.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('owner_user_id', ?)").bind(invitation.userId).run()
        },
      },
    })],
    advanced: {
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: baseURL.protocol === 'https:',
      },
    },
  })
}
