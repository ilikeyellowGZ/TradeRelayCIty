// CLI-only Better Auth schema input. The worker uses createAuth(env) in auth.ts and D1.
import { DatabaseSync } from 'node:sqlite'
import { betterAuth } from 'better-auth'
import { passkey } from '@better-auth/passkey'

export const auth = betterAuth({
  database: new DatabaseSync(':memory:'),
  emailAndPassword: { enabled: false },
  plugins: [passkey()],
})
