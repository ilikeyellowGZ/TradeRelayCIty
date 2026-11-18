import { describe, expect, it, vi } from 'vitest'
import { sendAccountEmail } from './auth-email'

const config = { apiKey: 'private-test-key', from: 'TradeRelayCity <hello@example.test>' }
const message = { to: 'user@example.test', subject: 'Verify account', text: 'Open https://example.test/verify?token=abc' }

describe('account email delivery', () => {
  it('sends a bounded text message to Resend without exposing the key in the body', async () => {
    const fakeFetch = vi.fn(async () => new Response('{"id":"message-1"}', { status: 200 })) as unknown as typeof fetch
    await sendAccountEmail(config, message, fakeFetch)
    expect(fakeFetch).toHaveBeenCalledOnce()
    const [url, init] = vi.mocked(fakeFetch).mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer private-test-key')
    expect(JSON.parse(String(init?.body))).toEqual({ from: config.from, to: [message.to], subject: message.subject, text: message.text })
    expect(String(init?.body)).not.toContain(config.apiKey)
  })

  it('returns a generic error for provider failures without leaking the response or key', async () => {
    const fakeFetch = vi.fn(async () => new Response('provider private details', { status: 429 })) as unknown as typeof fetch
    await expect(sendAccountEmail(config, message, fakeFetch)).rejects.toThrow('Account email delivery unavailable')
    await expect(sendAccountEmail(config, message, fakeFetch)).rejects.not.toThrow(/private-test-key|provider private details/)
  })

  it('rejects invalid recipients before making a request', async () => {
    const fakeFetch = vi.fn() as unknown as typeof fetch
    await expect(sendAccountEmail(config, { ...message, to: 'bad\nBcc: attacker@example.test' }, fakeFetch)).rejects.toThrow('Account email delivery unavailable')
    expect(fakeFetch).not.toHaveBeenCalled()
  })
})
