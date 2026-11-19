import { useState, type FormEvent } from 'react'
import { AccessFrame } from './PrivateAccessPage'
import { PublicBrand } from './PublicBrand'

export function ResetPasswordPage() {
  const [username, setUsername] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    if (newPassword.length < 12) { setError('Use a password with at least 12 characters.'); return }
    setBusy(true)
    try {
      const response = await fetch('/api/account/recover', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: username.trim(), recoveryCode: recoveryCode.trim(), newPassword }) })
      const result = await response.json() as { error?: string }
      if (!response.ok) { setError(result.error || 'Could not reset your password.'); return }
      setNewPassword(''); setRecoveryCode(''); setDone(true)
    } catch { setError('Account service is unavailable. Try again shortly.') }
    finally { setBusy(false) }
  }

  return <AccessFrame><PublicBrand /><p className="public-kicker access-kicker">ACCOUNT RECOVERY</p><h1>Use a recovery code.</h1>
    {done ? <div className="access-confirmation" role="status"><strong>Password changed.</strong><p>This code has been used and previous sessions have been signed out. Sign in with your new password.</p><a href="/login">Go to sign in</a></div> : <><p className="access-description">Enter your username and one unused code you saved when creating your account.</p>
      <form className="access-form" onSubmit={(event) => void submit(event)}>
        <label htmlFor="recovery-username">Username</label><input id="recovery-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
        <label htmlFor="recovery-code">Recovery code</label><input id="recovery-code" autoComplete="off" autoCapitalize="characters" spellCheck={false} value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" required />
        <label htmlFor="recovery-password">New password</label><input id="recovery-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={12} />
        {error && <p className="access-error" role="alert">{error}</p>}
        <button className="public-button access-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Reset password'}</button>
      </form></>}
    <p className="access-next"><a href="/login">Back to sign in</a></p>
  </AccessFrame>
}
