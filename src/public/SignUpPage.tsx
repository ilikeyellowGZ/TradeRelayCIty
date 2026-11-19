import { useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { AccessFrame } from './PrivateAccessPage'
import { PublicBrand } from './PublicBrand'

export function SignUpPage() {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [codes, setCodes] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || !/^[a-zA-Z0-9_.]{3,30}$/.test(username.trim())) { setError('Enter your name and a username of 3 to 30 letters, numbers, dots, or underscores.'); return }
    if (password.length < 12) { setError('Use a password with at least 12 characters.'); return }
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/account/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: name.trim(), username: username.trim(), password }) })
      const result = await response.json() as { recoveryCodes?: string[]; error?: string }
      if (!response.ok || !result.recoveryCodes) { setError(result.error || 'Could not create your account.'); return }
      setPassword('')
      setCodes(result.recoveryCodes)
    } catch { setError('Account service is unavailable. Try again shortly.') }
    finally { setBusy(false) }
  }

  async function copyCodes() {
    try { await navigator.clipboard.writeText(codes.join('\n')); setCopyStatus('Codes copied. Store them somewhere private.') }
    catch { setCopyStatus('Copy the codes below and store them somewhere private.') }
  }

  return <AccessFrame><PublicBrand /><p className="public-kicker access-kicker">START YOUR WORKSPACE</p><h1>{codes.length ? 'Save your recovery codes.' : 'Create your account.'}</h1>
    {codes.length ? <section className="access-confirmation" aria-label="Recovery codes"><p>These eight one-time codes can reset your password. They appear only now. Save them in a password manager or another private place before leaving this page. If you lose both your password and codes, your account cannot be recovered automatically.</p>
      <ol className="recovery-code-list">{codes.map((code) => <li key={code}><code>{code}</code></li>)}</ol>
      <button type="button" className="public-button public-button--secondary" onClick={() => void copyCodes()}>Copy all codes</button>
      {copyStatus && <p role="status">{copyStatus}</p>}
      <label className="recovery-acknowledge"><input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} /> I have saved these codes somewhere private.</label>
      {saved && <a className="public-button access-submit" href="/login">Continue to sign in <ArrowRight aria-hidden="true" size={22} /></a>}
    </section> : <><p className="access-description">Your workspace and MT5 connection are yours alone. No email address is needed.</p>
      <form className="access-form" onSubmit={(event) => void submit(event)} noValidate>
        <label htmlFor="signup-name">Name</label><input id="signup-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} />
        <label htmlFor="signup-username">Username</label><input id="signup-username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={30} />
        <label htmlFor="signup-password">Password</label><input id="signup-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} aria-describedby="signup-password-hint" />
        <p id="signup-password-hint" className="access-hint">At least 12 characters. Save the recovery codes shown after signup.</p>
        {error && <p className="access-error" role="alert">{error}</p>}
        <button className="public-button access-submit" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'} <ArrowRight aria-hidden="true" size={22} /></button>
      </form></>}
    <p className="access-next">Already have an account? <a href="/login">Sign in</a></p>
  </AccessFrame>
}
