type EmailConfig = { apiKey: string; from: string }
type AccountMessage = { to: string; subject: string; text: string }

const emailAddress = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/
const sender = /^(?:[^\r\n<>]{1,80} <)?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/
const errorMessage = 'Account email delivery unavailable'

export async function sendAccountEmail(
  config: EmailConfig,
  message: AccountMessage,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (!config.apiKey || config.apiKey.length > 512 || /\s/.test(config.apiKey) ||
      !sender.test(config.from) || config.from.length > 254 ||
      !emailAddress.test(message.to) || message.to.length > 254 ||
      !message.subject || message.subject.length > 120 || /[\r\n]/.test(message.subject) ||
      !message.text || message.text.length > 4096 || /\r/.test(message.text)) {
    throw new Error(errorMessage)
  }

  try {
    const response = await fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: config.from, to: [message.to], subject: message.subject, text: message.text }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(errorMessage)
  } catch {
    throw new Error(errorMessage)
  }
}
