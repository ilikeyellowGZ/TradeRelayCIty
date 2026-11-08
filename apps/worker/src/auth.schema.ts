// CLI-only Better Auth schema input. The worker uses createAuth(env) in auth.ts and D1.
import { DatabaseSync } from 'node:sqlite'
import { betterAuth } from 'better-auth'
import { username } from 'better-auth/plugins'

export const auth = betterAuth({
  database: new DatabaseSync(':memory:'),
  emailAndPassword: { enabled: true, disableSignUp: true },
  plugins: [username({ displayUsername: false, immutableUsername: true })],
  rateLimit: { enabled: true, storage: 'database' },
})
