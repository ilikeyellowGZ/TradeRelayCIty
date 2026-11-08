import { useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { authClient } from '../auth-client'
import { PublicBrand } from './PublicBrand'

export function AccessFrame({ children }: { children: ReactNode }) {
  return <div className="public-site access-page">
    <aside className="access-art" aria-label="TradeRelayCity private workspace">
      <div className="access-art-top"><PublicBrand /></div>
      <div className="access-editorial"><p className="public-kicker">YOUR PRIVATE WORKSPACE</p><h2>A clear view.<br />A considered next move.</h2><p>Review decisions. Keep your risk visible.</p></div>
    </aside>
    <main className="access-main"><a className="access-back" href="/"><ArrowLeft aria-hidden="true" size={21} /> Back to home</a><div className="access-content">{children}</div><p className="access-footer">Private access. No public sign-up.</p></main>
  </div>
}

export function PrivateAccessPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!username.trim()) { setError('Enter your username.'); return }
    if (!password) { setError('Enter your password.'); return }
    setBusy(true)
    setError('')
    try {
      const result = await authClient.signIn.username({ username: username.trim(), password })
      if (result.error || !result.data) {
        setError(result.error?.status === 429 ? 'Too many attempts. Wait a minute and try again.' : 'Username or password is incorrect.')
        return
      }
      window.location.replace('/app')
    } catch {
      setError('Sign-in service is unavailable. Try again shortly.')
    } finally {
      setBusy(false)
    }
  }

  return <AccessFrame>
    <PublicBrand />
    <p className="public-kicker access-kicker">PRIVATE OWNER ACCESS</p>
    <h1>Welcome back.</h1>
    <p className="access-description">Sign in to your TradeRelayCity workspace.</p>
    <form className="access-form" onSubmit={(event) => void submit(event)} noValidate>
      <label htmlFor="owner-username">Username</label>
      <input id="owner-username" type="text" value={username} onChange={(event) => { setUsername(event.target.value); if (error) setError('') }} autoComplete="username" autoCapitalize="none" spellCheck={false} aria-invalid={Boolean(error) && !username.trim()} placeholder="Enter your username" maxLength={30} />
      <label htmlFor="owner-password">Password</label>
      <div className="access-input-wrap"><input id="owner-password" type={visible ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); if (error) setError('') }} autoComplete="current-password" aria-invalid={Boolean(error) && !password} placeholder="Enter your password" /><button type="button" className="access-visibility" onClick={() => setVisible((value) => !value)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}>{visible ? <EyeOff aria-hidden="true" size={22} /> : <Eye aria-hidden="true" size={22} />}</button></div>
      {error && <p className="access-error" role="alert">{error}</p>}
      <button className="public-button access-submit" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <ArrowRight aria-hidden="true" size={24} /></button>
    </form>
  </AccessFrame>
}
