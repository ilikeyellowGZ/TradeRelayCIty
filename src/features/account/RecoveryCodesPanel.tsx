import { useState, type FormEvent } from 'react'
import './RecoveryCodesPanel.css'

export function RecoveryCodesPanel() {
  const [password, setPassword] = useState('')
  const [codes, setCodes] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function rotate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('')
    if (password.length < 12) { setError('Enter your current password.'); return }
    setBusy(true)
    try {
      const response = await fetch('/api/account/recovery-codes/rotate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) })
      const result = await response.json() as { recoveryCodes?: string[]; error?: string }
      if (!response.ok || !result.recoveryCodes) { setError(result.error || 'Could not generate new codes.'); return }
      setCodes(result.recoveryCodes); setPassword('')
    } catch { setError('Account service is unavailable. Try again shortly.') }
    finally { setBusy(false) }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(codes.join('\n')); setNotice('Codes copied. Save them in a password manager.') }
    catch { setNotice('Copy the codes below manually and save them in a password manager.') }
  }

  return <section className="panel security-panel" aria-labelledby="recovery-heading">
    <span className="eyebrow">ACCOUNT SECURITY</span><h2 id="recovery-heading">Recovery codes</h2>
    <p>Use a one-time code if you forget your password. New codes replace every previous code. This account has no email recovery.</p>
    {codes.length > 0 && <div className="security-codes" role="status"><strong>Save these codes now. They will not be shown again.</strong><ol>{codes.map((code) => <li key={code}><code>{code}</code></li>)}</ol><button className="pill-button pill-button--secondary" type="button" onClick={() => void copy()}>Copy all codes</button>{notice && <p>{notice}</p>}</div>}
    <form onSubmit={(event) => void rotate(event)}><label htmlFor="security-password">Current password</label><input id="security-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      {error && <p className="security-error" role="alert">{error}</p>}
      <button className="pill-button pill-button--primary" type="submit" disabled={busy}>{busy ? 'Generating…' : 'Generate new recovery codes'}</button></form>
  </section>
}
