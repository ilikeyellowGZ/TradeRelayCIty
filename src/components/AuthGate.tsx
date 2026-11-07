import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { authClient } from '../auth-client'

type Props = { onSignedIn: () => void }

export function AuthGate({ onSignedIn }: Props) {
  const [loading, setLoading] = useState(false)
  const [validInvite, setValidInvite] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [error, setError] = useState('')
  const token = new URLSearchParams(window.location.search).get('token') ?? ''
  const enrolling = window.location.pathname === '/enroll'

  useEffect(() => {
    let cancelled = false
    if (enrolling) {
      void fetch(`/api/invitations/validate?token=${encodeURIComponent(token)}`).then(async (response) => {
        const result = await response.json() as { valid?: boolean; displayName?: string }
        if (!cancelled) { setValidInvite(response.ok && result.valid === true); setInviteName(result.displayName ?? '') }
      }).catch(() => { if (!cancelled) setValidInvite(false) })
    } else {
      void authClient.getSession().then((result) => {
        if (result.data?.user) onSignedIn()
      }).catch(() => setError('Authentication service is unavailable.'))
    }
    return () => { cancelled = true }
  }, [enrolling, token, onSignedIn])

  async function authenticate() {
    setLoading(true)
    setError('')
    try {
      if (enrolling) {
        const result = await authClient.passkey.addPasskey({ name: 'TradeRelayCity passkey', context: token, createSession: true })
        if (result.error || !result.data) throw new Error(result.error?.message ?? 'Passkey enrollment failed.')
      } else {
        const result = await authClient.signIn.passkey()
        if (result.error || !result.data) throw new Error(result.error?.message ?? 'Passkey sign-in failed.')
      }
      onSignedIn()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed. Try again.')
    } finally { setLoading(false) }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="auth-heading">
        <div className="auth-mark"><ShieldCheck size={22} /></div>
        <div className="auth-kicker">TRADERELAYCITY · PRIVATE ACCESS</div>
        <h1 id="auth-heading">{enrolling ? 'Set up your passkey' : 'Welcome back'}<span>.</span></h1>
        <p>{enrolling ? validInvite ? `Your invitation is valid, ${inviteName}. Create a passkey to secure this account.` : 'This invitation is invalid, expired, or already used.' : 'Sign in with the passkey registered to your account.'}</p>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="auth-primary" type="button" onClick={() => void authenticate()} disabled={loading || (enrolling && !validInvite)}>
          {loading ? 'Waiting for your device…' : enrolling ? 'Create passkey' : 'Sign in with passkey'}
        </button>
        <div className="auth-footnote">No email reset or password fallback is configured. Ask the owner for a new invitation if you lose access.</div>
      </section>
    </main>
  )
}
