import { useState, type FormEvent } from 'react'
import { authClient } from '../auth-client'
import { AccessFrame } from './PrivateAccessPage'
import { PublicBrand } from './PublicBrand'

export function ResetPasswordPage({ reset = false }: { reset?: boolean }) {
  const token = new URLSearchParams(window.location.search).get('token')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    if (reset && !token) { setError('This reset link is invalid. Request a new one.'); return }
    if (reset && password.length < 12) { setError('Use a password with at least 12 characters.'); return }
    setBusy(true)
    try {
      if (reset) {
        const result = await authClient.resetPassword({ token: token!, newPassword: password })
        if (result.error) { setError('This reset link is invalid or expired. Request a new one.'); return }
      } else {
        await authClient.requestPasswordReset({ email: email.trim().toLowerCase(), redirectTo: '/reset-password' })
      }
      setDone(true)
    } catch { if (reset) setError('Password service is unavailable. Try again shortly.'); else setDone(true) }
    finally { setBusy(false) }
  }
  return <AccessFrame><PublicBrand /><p className="public-kicker access-kicker">ACCOUNT RECOVERY</p><h1>{reset ? 'Choose a new password.' : 'Reset your password.'}</h1>
    {done ? <div className="access-confirmation" role="status"><strong>{reset ? 'Password changed.' : 'Check your email.'}</strong><p>{reset ? 'Sign in with your new password. Previous sessions have been signed out.' : 'If an account exists for that email, a reset link is on its way.'}</p><a href="/login">Go to sign in</a></div> : <>
      <p className="access-description">{reset ? 'Use at least 12 characters for your new password.' : 'We will email you a link to set a new password.'}</p>
      <form className="access-form" onSubmit={(event) => void submit(event)}>{reset ? <><label htmlFor="reset-password">New password</label><input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} /></> : <><label htmlFor="reset-email">Email</label><input id="reset-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></>}
        {error && <p className="access-error" role="alert">{error}</p>}
        <button className="public-button access-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : reset ? 'Save new password' : 'Send reset link'}</button></form>
    </>}
    <p className="access-next"><a href="/login">Back to sign in</a></p>
  </AccessFrame>
}
