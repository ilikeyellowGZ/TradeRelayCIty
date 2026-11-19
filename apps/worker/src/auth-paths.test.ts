import { describe, expect, it } from 'vitest'
import { authPathAllowed } from './auth-paths'

describe('public auth route allowlist', () => {
  it.each([
    ['GET', '/get-session'], ['GET', '/verify-email'],
    ['POST', '/sign-up/email'], ['POST', '/sign-in/username'], ['POST', '/sign-out'],
    ['POST', '/send-verification-email'], ['POST', '/request-password-reset'], ['POST', '/reset-password'],
  ])('accepts %s %s', (method, path) => {
    expect(authPathAllowed(method, path)).toBe(true)
  })

  it.each([
    ['POST', '/sign-up/social'], ['POST', '/is-username-available'],
    ['GET', '/list-sessions'], ['DELETE', '/get-session'], ['POST', '/sign-in/email'],
  ])('rejects %s %s', (method, path) => {
    expect(authPathAllowed(method, path)).toBe(false)
  })

  it('accepts only bounded password reset callback tokens', () => {
    expect(authPathAllowed('GET', '/reset-password/abcdefghijklmnopqrstuvwx')).toBe(true)
    expect(authPathAllowed('GET', '/reset-password/../list-sessions')).toBe(false)
    expect(authPathAllowed('POST', '/reset-password/abcdefghijklmnopqrstuvwx')).toBe(false)
  })
})
