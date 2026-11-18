const allowed = new Set([
  'GET /get-session',
  'GET /verify-email',
  'POST /sign-up/email',
  'POST /sign-in/username',
  'POST /sign-out',
  'POST /send-verification-email',
  'POST /request-password-reset',
  'POST /reset-password',
])

export function authPathAllowed(method: string, path: string): boolean {
  return allowed.has(`${method} ${path}`)
}
