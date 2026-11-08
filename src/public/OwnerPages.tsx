import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { beginOwnerEnrollment, ownerRequest, ownerStage, signOutOwner, verifyOwnerCode } from '../owner-client'
import { AccessFrame, AuthenticatorPage } from './PrivateAccessPage'
import { PublicBrand } from './PublicBrand'

type Workspace = { workspaceName: string; updatedAt: string | null }
type Enrollment = { factorId: string; qrCode: string; secret: string }

export function OwnerMfaPage() {
  const [stage, setStage] = useState<'checking' | 'enroll' | 'verify'>('checking')
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void ownerStage().then((result) => {
      if (!active) return
      if (result === 'ready') window.location.replace('/app')
      else if (result === 'signed-out') window.location.replace('/login')
      else setStage(result)
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Authentication is unavailable.') })
    return () => { active = false }
  }, [])

  async function startEnrollment() {
    setBusy(true)
    setError('')
    try { setEnrollment(await beginOwnerEnrollment()) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start authenticator setup.') }
    finally { setBusy(false) }
  }

  async function verify(codeToCheck: string, factorId?: string) {
    setBusy(true)
    setError('')
    try {
      await verifyOwnerCode(codeToCheck, factorId)
      window.location.replace('/app')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Verification failed.')
      throw cause
    } finally { setBusy(false) }
  }

  if (stage === 'verify') return <AuthenticatorPage onVerify={(value) => verify(value)} busy={busy} />
  return <AccessFrame><PublicBrand /><p className="public-kicker access-kicker">PRIVATE OWNER ACCESS</p><h1>Secure your access.</h1><p className="access-description">Set up an authenticator app before opening your workspace.</p>
    {stage === 'checking' && !error && <p role="status">Checking your session…</p>}
    {error && <p className="access-error" role="alert">{error}</p>}
    {stage === 'enroll' && !enrollment && <button className="public-button access-submit" type="button" onClick={() => void startEnrollment()} disabled={busy}>{busy ? 'Preparing…' : 'Set up authenticator'} <ArrowRight aria-hidden="true" size={22} /></button>}
    {enrollment && <><p>Scan this code with your authenticator app. Keep the setup secret private.</p><img className="owner-qr" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qrCode)}`} alt="Authenticator setup QR code" /><details className="owner-secret"><summary>Enter setup key manually</summary><code>{enrollment.secret}</code></details>
      <form className="access-form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void verify(code, enrollment.factorId) }}><label htmlFor="owner-enroll-code">Six-digit code</label><input id="owner-enroll-code" className="access-code-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required placeholder="000000" /><button className="public-button access-submit" type="submit" disabled={busy || !/^\d{6}$/.test(code)}>{busy ? 'Verifying…' : 'Verify and continue'} <ArrowRight aria-hidden="true" size={22} /></button></form>
    </>}
  </AccessFrame>
}

export function OwnerWorkspacePage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void (async () => {
      const stage = await ownerStage()
      if (!active) return
      if (stage !== 'ready') { window.location.replace(stage === 'signed-out' ? '/login' : stage === 'enroll' ? '/login/enroll' : '/login/verify'); return }
      const loaded = await ownerRequest<Workspace>('/workspace')
      if (active) { setWorkspace(loaded); setName(loaded.workspaceName) }
    })().catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load your workspace.') })
    return () => { active = false }
  }, [])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const saved = await ownerRequest<Workspace>('/workspace', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspaceName: name }) })
      setWorkspace(saved)
      setMessage('Workspace saved to Supabase.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your workspace.') }
    finally { setBusy(false) }
  }

  return <AccessFrame><PublicBrand /><p className="public-kicker access-kicker">OWNER WORKSPACE</p><h1>{workspace?.workspaceName ?? 'Your workspace.'}</h1><p className="access-description">Your workspace name is stored in Supabase and is available only to your verified owner account.</p>
    {!workspace && !error && <p role="status">Loading your workspace…</p>}
    {error && <p className="access-error" role="alert">{error}</p>}
    {workspace && <><form className="access-form" onSubmit={(event) => void save(event)}><label htmlFor="owner-workspace-name">Workspace name</label><input id="owner-workspace-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /><button className="public-button access-submit" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save workspace'} <ArrowRight aria-hidden="true" size={22} /></button></form>{message && <p role="status">{message}</p>}<p className="owner-workspace-note">Broker connection and trading controls are not active in this owner workspace.</p><button className="access-recovery" type="button" onClick={() => void signOutOwner().then(() => window.location.replace('/login'))}>Sign out</button></>}
  </AccessFrame>
}
