import { useState, type FormEvent } from 'react'
import { authClient } from '../auth-client'
import { AccessFrame } from './PrivateAccessPage'
import { PublicBrand } from './PublicBrand'

export function VerifyEmailPage() {
  const params = new URLSearchParams(window.location.search)
  const verified = params.get('verified') === '1'
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(params.has('error') ? 'The verification link could not be used. Request a new one below.' : '')
  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const result = await authClient.sendVerificationEmail({ email: email.trim().toLowerCase(), callbackURL: '/verify-email?verified=1' })
      if (result.error) setError(result.error.status === 429 ? 'Too many attempts. Try again later.' : 'Could not send the link. Try again shortly.')
      else setMessage('If this account needs verification, a fresh link is on its way.')
    } catch { setError('Email service is unavailable. Try again shortly.') }
    finally { setBusy(false) }
  }
  return <AccessFrame><PublicBrand /><p className="public-kicker access-kicker">CONFIRM YOUR EMAIL</p><h1>{verified ? 'Email confirmed.' : 'Check your inbox.'}</h1>
    <p className="access-description">{verified ? 'You can sign in to your workspace now.' : 'Open the link we emailed you, then sign in to your workspace.'}</p>
    {!verified && <form className="access-form" onSubmit={(event) => void resend(event)}><label htmlFor="verify-email">Need a new link?</label><input id="verify-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Your email address" required />
      {error && <p className="access-error" role="alert">{error}</p>}{message && <p className="access-confirmation" role="status">{message}</p>}
      <button className="public-button access-submit" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Resend verification link'}</button></form>}
    <p className="access-next"><a href="/login">Back to sign in</a></p>
  </AccessFrame>
}
