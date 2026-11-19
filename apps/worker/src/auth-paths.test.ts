import { describe, expect, it } from 'vitest'
import { authPathAllowed } from './auth-paths'

describe('public auth route allowlist', () => {
  it.each([
    ['GET', '/get-session'], ['POST', '/sign-in/username'], ['POST', '/sign-out'],
  ])('accepts %s %s', (method, path) => {
    expect(authPathAllowed(method, path)).toBe(true)
  })

  it.each([
    ['POST', '/sign-up/social'], ['POST', '/sign-up/email'], ['POST', '/is-username-available'],
    ['GET', '/verify-email'], ['POST', '/send-verification-email'], ['POST', '/request-password-reset'], ['POST', '/reset-password'],
    ['GET', '/list-sessions'], ['DELETE', '/get-session'], ['POST', '/sign-in/email'],
  ])('rejects %s %s', (method, path) => {
    expect(authPathAllowed(method, path)).toBe(false)
  })

  it('rejects password reset callbacks', () => {
    expect(authPathAllowed('GET', '/reset-password/abcdefghijklmnopqrstuvwx')).toBe(false)
    expect(authPathAllowed('GET', '/reset-password/../list-sessions')).toBe(false)
    expect(authPathAllowed('POST', '/reset-password/abcdefghijklmnopqrstuvwx')).toBe(false)
  })
})
