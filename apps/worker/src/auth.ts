import { betterAuth } from 'better-auth'
import { username } from 'better-auth/plugins'

export type AuthEnv = {
  DB: D1Database
  APP_BASE_URL: string
  BETTER_AUTH_SECRET: string
}

export function createAuth(env: AuthEnv) {
  const baseURL = new URL(env.APP_BASE_URL)
  return betterAuth({
    database: env.DB,
    baseURL: env.APP_BASE_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_BASE_URL],
    emailAndPassword: { enabled: true, disableSignUp: true },
    plugins: [username({ displayUsername: false, immutableUsername: true })],
    disabledPaths: ['/sign-up/email', '/sign-in/email', '/is-username-available'],
    rateLimit: { enabled: true, storage: 'database', customRules: { '/sign-in/username': { window: 60, max: 5 } } },
    advanced: {
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: baseURL.protocol === 'https:',
      },
    },
  })
}
