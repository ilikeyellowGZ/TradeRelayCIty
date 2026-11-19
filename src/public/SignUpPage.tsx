import { useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { authClient } from '../auth-client'
import { AccessFrame } from './PrivateAccessPage'
import { PublicBrand } from './PublicBrand'

export function SignUpPage() {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || !username.trim() || !email.trim()) { setError('Complete every field to create your account.'); return }
    if (password.length < 12) { setError('Use a password with at least 12 characters.'); return }
    setBusy(true); setError('')
    try {
      const result = await authClient.signUp.email({ name: name.trim(), username: username.trim(), email: email.trim().toLowerCase(), password, callbackURL: '/verify-email' })
      if (result.error) { setError(result.error.status === 429 ? 'Too many attempts. Try again later.' : result.error.message || 'Could not create your account.'); return }
      setSent(true)
    } catch { setError('Account service is unavailable. Try again shortly.') }
    finally { setBusy(false) }
  }

  return <AccessFrame><PublicBrand /><p className="public-kicker access-kicker">START YOUR WORKSPACE</p><h1>Create your account.</h1>
    {sent ? <div className="access-confirmation" role="status"><strong>Check your email.</strong><p>We sent a verification link to {email.trim().toLowerCase()}. Open it before signing in.</p><a href="/login">Go to sign in</a></div> : <>
      <p className="access-description">Your workspace and MT5 connection are yours alone.</p>
      <form className="access-form" onSubmit={(event) => void submit(event)} noValidate>
        <label htmlFor="signup-name">Name</label><input id="signup-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} />
        <label htmlFor="signup-username">Username</label><input id="signup-username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={30} />
        <label htmlFor="signup-email">Email</label><input id="signup-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <label htmlFor="signup-password">Password</label><input id="signup-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} aria-describedby="signup-password-hint" />
        <p id="signup-password-hint" className="access-hint">At least 12 characters.</p>
        {error && <p className="access-error" role="alert">{error}</p>}
        <button className="public-button access-submit" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'} <ArrowRight aria-hidden="true" size={22} /></button>
      </form>
    </>}
    <p className="access-next">Already have an account? <a href="/login">Sign in</a></p>
  </AccessFrame>
}
