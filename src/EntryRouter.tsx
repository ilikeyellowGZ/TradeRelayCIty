import { lazy, Suspense, useEffect } from 'react'
import { LandingPage } from './public/LandingPage'
import { PrivateAccessPage } from './public/PrivateAccessPage'
import { OwnerMfaPage, OwnerWorkspacePage } from './public/OwnerPages'

const DemoApp = lazy(() => import('./App'))

function RedirectToLogin({ challengeExpired = false }: { challengeExpired?: boolean }) {
  useEffect(() => { window.location.replace(challengeExpired ? '/login?notice=challenge-expired' : '/login') }, [challengeExpired])
  return <main className="route-loading" role="status">Opening private access…</main>
}

export default function EntryRouter() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  useEffect(() => { document.title = path === '/' ? 'TradeRelayCity — Your trading. A clearer view.' : 'Private access — TradeRelayCity' }, [path])

  if (path === '/') return <LandingPage />
  if (path === '/login') return <PrivateAccessPage />
  if (path === '/login/verify' || path === '/login/enroll') return <OwnerMfaPage />
  if (path === '/app/demo' && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)) return <Suspense fallback={<main className="route-loading">Loading simulation…</main>}><DemoApp /></Suspense>
  if (path === '/app') return <OwnerWorkspacePage />
  if (path === '/enroll') return <RedirectToLogin />
  return <LandingPage />
}
