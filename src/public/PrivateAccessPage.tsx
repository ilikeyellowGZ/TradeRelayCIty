import { useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { PublicBrand } from './PublicBrand'
import { signInOwner } from '../owner-client'
import '../owner.css'

export function AccessFrame({ children }: { children: ReactNode }) {
  return <div className="public-site access-page">
    <aside className="access-art" aria-label="TradeRelayCity private workspace">
      <div className="access-art-top"><PublicBrand /></div>
      <div className="access-editorial"><p className="public-kicker">YOUR PRIVATE WORKSPACE</p><h2>A clear view.<br />A considered next move.</h2><p>Review decisions. Keep your risk visible.</p></div>
    </aside>
    <main className="access-main"><a className="access-back" href="/"><ArrowLeft aria-hidden="true" size={21} /> Back to home</a><div className="access-content">{children}</div><p className="access-footer">Private access. No public sign-up.</p></main>
  </div>
}

function AccessIntro({ verify = false }: { verify?: boolean }) {
  return <><PublicBrand /><p className="public-kicker access-kicker">PRIVATE OWNER ACCESS</p><h1>{verify ? 'Verify your access.' : 'Welcome back.'}</h1><p className="access-description">{verify ? 'Enter the six-digit code from your authenticator.' : 'Sign in to your TradeRelayCity workspace.'}</p></>
}

export function PrivateAccessPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const challengeExpired = new URLSearchParams(window.location.search).get('notice') === 'challenge-expired'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim()) { setError('Enter your email address.'); return }
    if (!password) { setError('Enter your password.'); return }
    setBusy(true)
    setError('')
    try {
      const stage = await signInOwner(email.trim(), password)
      window.location.assign(stage === 'ready' ? '/app' : stage === 'enroll' ? '/login/enroll' : '/login/verify')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed.')
    } finally { setBusy(false) }
  }

  return <AccessFrame><AccessIntro />{challengeExpired && <p className="access-error" role="alert">Your verification challenge is missing or expired. Enter your password to start again.</p>}<form className="access-form" onSubmit={(event) => void submit(event)} noValidate>
    <label htmlFor="owner-email">Email</label><input id="owner-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); if (error) setError('') }} autoComplete="username" required placeholder="Owner email" />
    <label htmlFor="owner-password">Password</label>
    <div className="access-input-wrap"><input id="owner-password" type={visible ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); if (error) setError('') }} autoComplete="current-password" aria-invalid={Boolean(error)} aria-describedby={error ? 'password-error' : undefined} placeholder="Enter your password" /><button type="button" className="access-visibility" onClick={() => setVisible((value) => !value)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}>{visible ? <EyeOff aria-hidden="true" size={22} /> : <Eye aria-hidden="true" size={22} />}</button></div>
    {error && <p className="access-error" id="password-error" role="alert">{error}</p>}
    <button className="public-button access-submit" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Continue'} <ArrowRight aria-hidden="true" size={24} /></button>
  </form><p className="access-next"><LockKeyhole aria-hidden="true" size={20} /> Next: verify with your authenticator.</p><button className="access-recovery" type="button" aria-expanded={recoveryOpen} aria-controls="recovery-guidance" onClick={() => setRecoveryOpen((value) => !value)}>Use recovery options</button>{recoveryOpen && <div className="recovery-guidance" id="recovery-guidance"><strong>Recovery is not available in this build.</strong><p>Use your Supabase administrator account to restore owner access after verifying your identity.</p></div>}</AccessFrame>
}

export function AuthenticatorPage({ onVerify, busy = false }: { onVerify: (code: string) => Promise<void>; busy?: boolean }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!/^\d{6}$/.test(code)) { setError('Enter the six-digit code from your authenticator.'); return }
    try { await onVerify(code) } catch { setError('Verification could not be completed. Check the code and try again.') }
  }
  return <AccessFrame><AccessIntro verify /><form className="access-form" onSubmit={(event) => void submit(event)} noValidate>
    <label htmlFor="authenticator-code">Authenticator code</label><input id="authenticator-code" className="access-code-input" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }} aria-invalid={Boolean(error)} aria-describedby={error ? 'code-error' : undefined} placeholder="000000" />
    {error && <p className="access-error" id="code-error" role="alert">{error}</p>}
    <button className="public-button access-submit" type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify and continue'} <ArrowRight aria-hidden="true" size={24} /></button>
  </form><a className="access-recovery" href="/login">Back to password entry</a></AccessFrame>
}
