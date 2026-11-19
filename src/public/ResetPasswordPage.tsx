import { useState, type FormEvent, type ReactNode } from 'react'
import { authClient } from '../auth-client'
import { AccessFrame } from './PrivateAccessPage'
import { PublicBrand } from './PublicBrand'

function RecoveryFrame({ title, children }: { title: string; children: ReactNode }) {
  return <AccessFrame><PublicBrand /><p className="public-kicker access-kicker">ACCOUNT RECOVERY</p><h1>{title}</h1>{children}<p className="access-next"><a href="/login">Back to sign in</a></p></AccessFrame>
}

function RequestResetPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true)
    try { await authClient.requestPasswordReset({ email: email.trim().toLowerCase(), redirectTo: '/reset-password' }) }
    catch { /* Keep account existence and delivery failures private. */ }
    finally { setDone(true); setBusy(false) }
  }
  return <RecoveryFrame title="Reset your password.">{done ? <div className="access-confirmation" role="status"><strong>Check your email.</strong><p>If an account exists for that email, a reset link is on its way.</p><a href="/login">Go to sign in</a></div> : <><p className="access-description">We will email you a link to set a new password.</p><form className="access-form" onSubmit={(event) => void submit(event)}><label htmlFor="reset-email">Email</label><input id="reset-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /><button className="public-button access-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Send reset link'}</button></form></>}</RecoveryFrame>
}

function SetNewPasswordPage() {
  const token = new URLSearchParams(window.location.search).get('token')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    if (!token) { setError('This reset link is invalid. Request a new one.'); return }
    if (password.length < 12) { setError('Use a password with at least 12 characters.'); return }
    setBusy(true)
    try {
      const result = await authClient.resetPassword({ token, newPassword: password })
      if (result.error) setError('This reset link is invalid or expired. Request a new one.')
      else setDone(true)
    } catch { setError('Password service is unavailable. Try again shortly.') }
    finally { setBusy(false) }
  }
  return <RecoveryFrame title="Choose a new password.">{done ? <div className="access-confirmation" role="status"><strong>Password changed.</strong><p>Sign in with your new password. Previous sessions have been signed out.</p><a href="/login">Go to sign in</a></div> : <><p className="access-description">Use at least 12 characters for your new password.</p><form className="access-form" onSubmit={(event) => void submit(event)}><label htmlFor="reset-password">New password</label><input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} />{error && <p className="access-error" role="alert">{error}</p>}<button className="public-button access-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Save new password'}</button></form></>}</RecoveryFrame>
}

export function ResetPasswordPage({ reset = false }: { reset?: boolean }) {
  return reset ? <SetNewPasswordPage /> : <RequestResetPage />
}
