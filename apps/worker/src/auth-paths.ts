const allowed = new Set([
  'GET /get-session',
  'POST /sign-in/username',
  'POST /sign-out',
])

export function authPathAllowed(method: string, path: string): boolean {
  return allowed.has(`${method} ${path}`)
}
