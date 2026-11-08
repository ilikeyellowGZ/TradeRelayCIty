import { useEffect } from 'react'
import { LandingPage } from './public/LandingPage'
import { PrivateAccessPage } from './public/PrivateAccessPage'

function RedirectToLogin({ challengeExpired = false }: { challengeExpired?: boolean }) {
  useEffect(() => { window.location.replace(challengeExpired ? '/login?notice=challenge-expired' : '/login') }, [challengeExpired])
  return <main className="route-loading" role="status">Opening private access…</main>
}

export default function EntryRouter() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  useEffect(() => { document.title = path === '/' ? 'TradeRelayCity — Your trading. A clearer view.' : 'Private access — TradeRelayCity' }, [path])

  if (path === '/') return <LandingPage />
  if (path === '/login') return <PrivateAccessPage />
  if (path === '/login/verify' || path === '/login/enroll') return <RedirectToLogin challengeExpired />
  if (path === '/app' || path.startsWith('/app/')) return <RedirectToLogin />
  if (path === '/enroll') return <RedirectToLogin />
  return <LandingPage />
}
