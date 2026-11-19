import { betterAuth } from 'better-auth'
import { username } from 'better-auth/plugins'
import { sendAccountEmail } from './auth-email'

export type AuthEnv = {
  DB: D1Database
  APP_BASE_URL: string
  BETTER_AUTH_SECRET: string
  RESEND_API_KEY?: string
  EMAIL_FROM?: string
}

export function createAuth(env: AuthEnv) {
  const baseURL = new URL(env.APP_BASE_URL)
  return betterAuth({
    database: env.DB,
    baseURL: env.APP_BASE_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_BASE_URL],
    emailAndPassword: {
      enabled: true,
      disableSignUp: false,
      minPasswordLength: 12,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendAccountEmail(
          { apiKey: env.RESEND_API_KEY ?? '', from: env.EMAIL_FROM ?? '' },
          { to: user.email, subject: 'Reset your TradeRelayCity password', text: `Reset your password: ${url}` },
        )
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendAccountEmail(
          { apiKey: env.RESEND_API_KEY ?? '', from: env.EMAIL_FROM ?? '' },
          { to: user.email, subject: 'Verify your TradeRelayCity account', text: `Verify your email: ${url}` },
        )
      },
    },
    plugins: [username({ displayUsername: false, immutableUsername: true })],
    disabledPaths: ['/sign-in/email', '/is-username-available'],
    rateLimit: { enabled: true, storage: 'database', customRules: {
      '/sign-in/username': { window: 60, max: 5 },
      '/sign-up/email': { window: 3600, max: 3 },
      '/send-verification-email': { window: 3600, max: 3 },
      '/request-password-reset': { window: 3600, max: 3 },
    } },
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
