import { lazy, Suspense, useEffect, useState } from 'react'
import { LandingPage } from './public/LandingPage'
import { PrivateAccessPage } from './public/PrivateAccessPage'
import { authClient } from './auth-client'

const Workspace = lazy(() => import('./App'))

function RedirectToLogin() {
  useEffect(() => { window.location.replace('/login') }, [])
  return <main className="route-loading" role="status">Opening private access…</main>
}

function ProtectedWorkspace() {
  const [status, setStatus] = useState<'checking' | 'ready' | 'signed-out' | 'error'>('checking')
  useEffect(() => {
    let active = true
    void authClient.getSession().then((result) => {
      if (active) setStatus(result.data?.user ? 'ready' : 'signed-out')
    }).catch(() => { if (active) setStatus('error') })
    return () => { active = false }
  }, [])
  useEffect(() => { if (status === 'signed-out') window.location.replace('/login') }, [status])
  if (status === 'error') return <main className="route-loading" role="alert">Could not check your session. <a href="/login">Return to sign in</a></main>
  if (status !== 'ready') return <main className="route-loading" role="status">Opening private access…</main>
  return <Suspense fallback={<main className="route-loading" role="status">Loading workspace…</main>}><Workspace /></Suspense>
}

export default function EntryRouter() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  useEffect(() => { document.title = path === '/' ? 'TradeRelayCity — Your trading. A clearer view.' : path.startsWith('/app') ? 'Workspace — TradeRelayCity' : 'Sign in — TradeRelayCity' }, [path])

  if (path === '/') return <LandingPage />
  if (path === '/login') return <PrivateAccessPage />
  if (path === '/login/verify' || path === '/login/enroll') return <RedirectToLogin />
  if (path === '/app' || path.startsWith('/app/')) return <ProtectedWorkspace />
  if (path === '/enroll') return <RedirectToLogin />
  return <LandingPage />
}
