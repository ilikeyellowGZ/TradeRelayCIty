import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import {
  Activity, ArrowUpRight, Bell, Bot, BriefcaseBusiness, Check,
  ChevronDown, CircleHelp, Clock3, Command, FlaskConical,
  Gauge, LayoutDashboard, LogOut, Menu, MessageCircle, MoreHorizontal, Moon, Sun,
  ShieldCheck, SlidersHorizontal, Sparkles, WalletCards, X,
} from 'lucide-react'
import { BotifyMark } from './components/BotifyMark'
import { ScoreboardChart } from './components/ScoreboardChart'
import { AssistantPage } from './components/AssistantPage'
import { TradeHistoryPage } from './features/trade-history/TradeHistoryPage'
import { BrokerPage } from './features/broker/BrokerPage'
import { BrokerAssistantPage } from './features/broker/BrokerAssistantPage'
import { getConnectionStatus, type ConnectorDevice } from './features/broker/connectionStatus'
import { authClient } from './auth-client'

type SimUser = { id: string; name: string; role: 'owner' | 'member' }
type SimAccount = { id: string; ownerId: string; label: string; broker: string; environment: 'DEMO'; mode: 'SIMULATED'; connected: boolean; balance: { amount: number; currency: string }; equity: number; dailyPnl: number; positions: { id: string; symbol: string; description: string; side: 'BUY' | 'SELL'; volume: number; entry: number; market: number; pnl: number; source: 'SIMULATED' }[]; events: { id: string; message: string }[]; latestDecision: { decision: string; rationale: string } }

const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Accounts', icon: WalletCards },
  { label: 'Bots & Strategies', icon: Bot },
  { label: 'Positions', icon: BriefcaseBusiness },
  { label: 'Trade History', icon: Activity },
  { label: 'Assistant', icon: MessageCircle },
  { label: 'Backtests', icon: FlaskConical },
  { label: 'Risk Settings', icon: ShieldCheck },
  { label: 'Notifications', icon: Bell },
]

const activities = [
  { title: 'Account snapshot refreshed', detail: 'Illustrative preview · just now', icon: Activity, tone: 'blue' },
  { title: 'Risk profile reviewed', detail: 'Preview state · 18 min ago', icon: ShieldCheck, tone: 'cream' },
  { title: 'Strategy workspace opened', detail: 'No broker connection · 42 min ago', icon: Bot, tone: 'red' },
]

function Sidebar({ active, onNavigate, open, onClose, isMobile }: { active: string; onNavigate: (name: string) => void; open: boolean; onClose: () => void; isMobile: boolean }) {
  const reduceMotion = useReducedMotion()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (open && isMobile) closeButtonRef.current?.focus() }, [open, isMobile])
  useEffect(() => {
    if (!moreOpen) return
    const closeOnOutside = (event: PointerEvent) => { if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false) }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMoreOpen(false); moreButtonRef.current?.focus() } }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', closeOnOutside); document.removeEventListener('keydown', closeOnEscape) }
  }, [moreOpen])
  const primaryItems = [
    { label: 'Overview', icon: LayoutDashboard, destination: 'Overview' },
    { label: 'Trading', icon: Bot, destination: 'Bots & Strategies' },
    { label: 'History', icon: Activity, destination: 'Trade History' },
    { label: 'Assistant', icon: MessageCircle, destination: 'Assistant' },
  ]
  const secondaryItems = navItems.filter(({ label }) => !['Overview', 'Trade History', 'Assistant'].includes(label))
  return (
    <>
      <AnimatePresence>
        {isMobile && open && <m.button className="drawer-scrim" aria-label="Close navigation" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />}
      </AnimatePresence>
      <aside className={`sidebar${open ? ' sidebar--open' : ''}`} aria-label="Main navigation" inert={isMobile && !open} onKeyDown={(event) => {
        if (!isMobile || !open || event.key !== 'Tab') return
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')).filter((button) => button.getClientRects().length > 0)
        const first = controls[0]
        const last = controls.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }}>
        <div className="sidebar-top">
          <button className="brand-link" type="button" onClick={() => { onNavigate('Overview'); onClose() }} aria-label="TradeRelayCity overview">
            <BotifyMark />
            <span className="brand-name">TradeRelayCity</span>
          </button>
          <button ref={closeButtonRef} className="mobile-close icon-button" type="button" onClick={onClose} aria-label="Close navigation"><X size={20} /></button>
        </div>

        <nav className="primary-nav" aria-label="Workspace destinations">
          {primaryItems.map(({ label, destination, icon: Icon }) => (
            <button key={label} type="button" className={`nav-item${active === destination ? ' nav-item--active' : ''}`} aria-label={label} aria-current={active === destination ? 'page' : undefined} onClick={() => { onNavigate(destination); onClose() }}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
            </button>
          ))}
          <div className="nav-more-wrap" ref={moreRef}>
            <button ref={moreButtonRef} className={`nav-item nav-more-trigger${moreOpen || secondaryItems.some((item) => item.label === active) ? ' nav-item--active' : ''}`} type="button" aria-label="More destinations" aria-expanded={moreOpen} aria-controls="more-destinations" onClick={() => setMoreOpen((value) => !value)}><MoreHorizontal size={18} /><span>More</span><ChevronDown size={15} /></button>
            <AnimatePresence>
              {moreOpen && <m.div id="more-destinations" className="nav-more-menu" role="group" aria-label="More destinations" initial={reduceMotion ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -6 }} transition={{ duration: reduceMotion ? 0 : 0.16 }}>{secondaryItems.map(({ label, icon: Icon }) => <button key={label} type="button" aria-current={active === label ? 'page' : undefined} onClick={() => { onNavigate(label); setMoreOpen(false); onClose() }}><Icon size={16} />{label}</button>)}</m.div>}
            </AnimatePresence>
          </div>
        </nav>

        <nav className="mobile-drawer-nav" aria-label="Mobile workspace destinations">
          <span className="mobile-drawer-label">WORKSPACE</span>
          {navItems.map(({ label, icon: Icon }) => <button key={label} type="button" className={`mobile-drawer-item${active === label ? ' mobile-drawer-item--active' : ''}`} aria-current={active === label ? 'page' : undefined} onClick={() => { onNavigate(label); onClose() }}><Icon size={19} strokeWidth={1.8} /><span>{label}</span><ArrowUpRight size={15} className="mobile-drawer-arrow" aria-hidden="true" /></button>)}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-card">
          <div className="sidebar-card-icon"><ShieldCheck size={17} /></div>
          <div><strong>Risk first.</strong><p>Every account. Every session.</p></div>
          <button type="button" className="sidebar-card-more" aria-label="Risk information"><MoreHorizontal size={17} /></button>
        </div>
        <div className="stadium-mark" aria-hidden="true">
          <svg viewBox="0 0 220 104" fill="none">
            <path d="M7 71h206M18 71l14-20h156l14 20M37 51V26m146 25V26M30 28l7-12 7 12m126 0 7-12 7 12M55 71v15m110-15v15M22 86h176M56 86c9-12 25-18 54-18s45 6 54 18M91 68v18m38-18v18" stroke="currentColor" strokeWidth="1.4" />
            <path d="M20 40h16m148 0h16" stroke="var(--red-400)" strokeWidth="2" />
            <circle cx="38" cy="15" r="2" fill="currentColor" /><circle cx="182" cy="15" r="2" fill="currentColor" />
          </svg>
          <span className="stadium-rule" />
        </div>
        <div className="sidebar-user">
          <div className="avatar">JD</div><div className="user-copy"><strong>Jordan Davis</strong><span>Personal workspace</span></div>
          <button className="user-menu icon-button" type="button" disabled aria-label="Profile menu unavailable in preview" title="Profile actions need the application backend"><MoreHorizontal size={18} /></button>
        </div>
      </aside>
    </>
  )
}

function SectionPreview({ active }: { active: string }) {
  const details: Record<string, { icon: typeof Bot; title: string; body: string }> = {
    Accounts: { icon: WalletCards, title: 'Your account workspace', body: 'Broker linking and account management will appear here when the application services are connected.' },
    'Bots & Strategies': { icon: Bot, title: 'Strategy workspace', body: 'Strategy configuration and bot controls are presentation-only in this frontend preview.' },
    Positions: { icon: BriefcaseBusiness, title: 'Position monitor', body: 'A live positions feed is not connected. No trades can be opened or managed here.' },
    'Trade History': { icon: Activity, title: 'Trade ledger', body: 'Trade history will populate after a broker and application backend are configured.' },
    Backtests: { icon: FlaskConical, title: 'Research lab', body: 'Backtest controls and results are not connected. No performance claims are shown in this preview.' },
    'Risk Settings': { icon: ShieldCheck, title: 'Risk controls', body: 'Risk policy editing requires a secured backend and account-specific configuration.' },
    Notifications: { icon: Bell, title: 'Notifications', body: 'Notification preferences and delivery are not connected in this frontend-only build.' },
  }
  const detail = details[active] ?? details.Accounts
  const Icon = detail.icon
  return (
    <m.section className="destination-preview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
      <div className="destination-icon"><Icon size={23} /></div>
      <span className="eyebrow">FRONTEND PREVIEW</span>
      <h2>{detail.title}</h2>
      <p>{detail.body}</p>
      <div className="preview-divider" />
      <div className="destination-note"><CircleHelp size={16} /> This screen contains no account actions or live data.</div>
    </m.section>
  )
}

function App() {
  const reduceMotion = useReducedMotion()
  const [active, setActive] = useState('Overview')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => window.localStorage.getItem('trc-theme') === 'light' ? 'light' : 'dark')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const accountRef = useRef<HTMLDivElement>(null)
  const accountButtonRef = useRef<HTMLButtonElement>(null)
  const [connectorDevices, setConnectorDevices] = useState<ConnectorDevice[] | null>(null)
  const [connectorError, setConnectorError] = useState(false)
  const [statusNow, setStatusNow] = useState(Date.now())
  const [range, setRange] = useState('1W')
  const [accountOpen, setAccountOpen] = useState(false)
  const [users, setUsers] = useState<SimUser[]>([])
  const [userId, setUserId] = useState('sim-owner')
  const [account, setAccount] = useState<SimAccount | null>(null)
  const [apiError, setApiError] = useState('')
  const [signOutError, setSignOutError] = useState('')
  const [aiMessage, setAiMessage] = useState('Mock AI is idle; live AI is not configured.')
  const [aiBusy, setAiBusy] = useState(false)
  const [assistantSource, setAssistantSource] = useState<'simulation' | 'broker'>('simulation')
  const [simulationAvailable, setSimulationAvailable] = useState<boolean | null>(null)
  const dashboardRef = useRef<HTMLDivElement>(null)
  const brokerPage = active === 'Accounts' || active === 'Positions' || (active === 'Overview' && simulationAvailable === false)
  const brokerView = simulationAvailable === false || brokerPage || (active === 'Assistant' && assistantSource === 'broker')
  const connectorStatus = connectorError
    ? { tone: 'muted' as const, label: 'MT5 status unavailable', detail: 'Could not check the connector. Open Accounts to retry.' }
    : connectorDevices === null
      ? { tone: 'muted' as const, label: 'Checking MT5…', detail: 'Checking your paired Windows connector.' }
      : getConnectionStatus(connectorDevices, statusNow)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)')
    const syncWidth = () => { setIsMobile(media.matches); if (!media.matches) setDrawerOpen(false) }
    media.addEventListener('change', syncWidth)
    return () => media.removeEventListener('change', syncWidth)
  }, [])

  useEffect(() => {
    if (!drawerOpen || !isMobile) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setDrawerOpen(false); menuButtonRef.current?.focus() } }
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', closeOnEscape) }
  }, [drawerOpen, isMobile])

  useEffect(() => {
    if (!accountOpen) return
    const closeOnOutside = (event: PointerEvent) => { if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false) }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setAccountOpen(false); accountButtonRef.current?.focus() } }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', closeOnOutside); document.removeEventListener('keydown', closeOnEscape) }
  }, [accountOpen])

  useEffect(() => {
    let cancelled = false
    async function refreshConnector() {
      try {
        const response = await fetch('/api/broker/devices', { cache: 'no-store' })
        if (!response.ok) throw new Error('Connector status unavailable')
        const data = await response.json() as { devices: ConnectorDevice[] }
        if (!cancelled) { setConnectorDevices(data.devices); setConnectorError(false); setStatusNow(Date.now()) }
      } catch { if (!cancelled) setConnectorError(true) }
    }
    void refreshConnector()
    const timer = window.setInterval(() => { setStatusNow(Date.now()); void refreshConnector() }, 15_000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [active])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('trc-theme', theme)
  }, [theme])

  useEffect(() => { window.scrollTo(0, 0) }, [active, assistantSource])

  useEffect(() => {
    const headers = { 'x-simulation-user': userId }
    let cancelled = false
    async function loadSimulation() {
      try {
        const healthResponse = await fetch('/api/health', { cache: 'no-store' })
        if (!healthResponse.ok) throw new Error('Could not check workspace availability.')
        const health = await healthResponse.json() as { mode: string }
        if (cancelled) return
        const simulation = health.mode === 'SIMULATED'
        setSimulationAvailable(simulation)
        if (!simulation) { setAssistantSource('broker'); setApiError(''); return }
        const [sessionResponse, accountsResponse] = await Promise.all([
          fetch('/api/simulation/session', { headers }),
          fetch('/api/simulation/accounts', { headers }),
        ])
        if (!sessionResponse.ok || !accountsResponse.ok) throw new Error('Local simulation API is unavailable. Start it with npm run dev.')
        const session = await sessionResponse.json() as { users: SimUser[] }
        const accountList = await accountsResponse.json() as { accounts: { id: string }[] }
        const accountId = accountList.accounts[0]?.id
        if (!accountId) throw new Error('No simulation account is available for this persona.')
        const overviewResponse = await fetch(`/api/simulation/accounts/${accountId}/overview`, { headers })
        if (!overviewResponse.ok) throw new Error('The selected simulation account could not be loaded.')
        const overview = await overviewResponse.json() as SimAccount
        if (!cancelled) { setUsers(session.users); setAccount(overview); setApiError('') }
      } catch (error) {
        if (!cancelled) setApiError(error instanceof Error ? error.message : 'Simulation API request failed.')
      }
    }
    void loadSimulation()
    return () => { cancelled = true }
  }, [userId])

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.from('.metric-card', { opacity: 0, y: 12, duration: 0.48, stagger: 0.075, ease: 'power2.out' })
  }, { scope: dashboardRef, dependencies: [account?.id], revertOnUpdate: true })

  const formatMoney = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: account?.balance.currency ?? 'USD' }).format(value)
  const positions = account?.positions.map((position) => ({
    symbol: position.symbol,
    detail: position.description,
    side: position.side === 'BUY' ? 'Buy' : 'Sell',
    size: position.volume.toFixed(2),
    entry: position.entry.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 }),
    last: position.market.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 }),
    pnl: `${position.pnl >= 0 ? '+' : '−'}${Math.abs(position.pnl).toFixed(2)}`,
    state: position.pnl >= 0 ? 'positive' : 'negative',
  })) ?? []

  async function requestMockReview() {
    setAiBusy(true)
    try {
      const response = await fetch('/api/simulation/ai/decision', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-simulation-user': userId },
        body: JSON.stringify({ snapshotId: `ui-${Date.now()}`, candidate: null }),
      })
      const result = await response.json() as { decision?: string; rationale?: string; usage?: { requestCount: number; userLimit: number }; error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Mock AI request failed.')
      setAiMessage(`${result.decision}: ${result.rationale} (${result.usage?.requestCount}/${result.usage?.userLimit} daily requests)`)
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : 'Mock AI is unavailable.')
    } finally { setAiBusy(false) }
  }

  async function signOut() {
    setSignOutError('')
    try {
      const result = await authClient.signOut()
      if (result.error) throw new Error('Sign-out request failed.')
      window.location.replace('/login')
    } catch {
      setSignOutError('Could not sign out. Try again.')
    }
  }

  return (
    <LazyMotion features={domAnimation}>
    <div className="app-shell" ref={dashboardRef}>
      <Sidebar active={active} onNavigate={setActive} open={drawerOpen} isMobile={isMobile} onClose={() => { setDrawerOpen(false); if (isMobile) menuButtonRef.current?.focus() }} />
      <main className="main-area">
        <header className="topbar">
          <button ref={menuButtonRef} className="mobile-menu icon-button" type="button" onClick={() => setDrawerOpen(true)} aria-label="Open navigation" aria-expanded={drawerOpen}><Menu size={21} /></button>
          {brokerView && <div className="topbar-broker-context"><strong>Broker connection</strong><small>MT5 read-only snapshots</small></div>}
          <div ref={accountRef} className={`topbar-account${brokerView ? ' topbar-account--hidden' : ''}`}>
            <button ref={accountButtonRef} className="account-switcher" type="button" aria-expanded={accountOpen} onClick={() => setAccountOpen((value) => !value)}>
              <span className="account-labels"><strong>{account?.label ?? 'Loading simulation…'}</strong><small>Change account</small></span>
            </button>
            <AnimatePresence>
              {accountOpen && <m.div className="account-menu" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}>
                <strong>Choose simulation persona</strong>{users.map((user) => <button className="persona-option" type="button" key={user.id} onClick={() => { setUserId(user.id); setAccountOpen(false) }}>{user.name}{user.id === userId ? ' · selected' : ''}</button>)}<span>Each persona has an isolated simulated account.</span>
              </m.div>}
            </AnimatePresence>
          </div>
          <div className={`topbar-state${brokerView ? ' topbar-state--hidden' : ''}`}><span className="mode-badge"><span />{account?.mode ?? 'SIMULATED'} · {account?.environment ?? 'DEMO'}</span><span className="state-divider" /><span className={`connection-dot${account?.connected ? ' connection-dot--online' : ''}`} /><span className="connection-copy">{account?.connected ? 'Connector demo fixture' : 'Connector offline'}</span></div>
          <button type="button" className={`mt5-status mt5-status--${connectorStatus.tone}`} onClick={() => setActive('Accounts')} title={`${connectorStatus.detail} View broker accounts.`} aria-label={`${connectorStatus.label}. ${connectorStatus.detail} View broker accounts.`}><span className="mt5-status-dot" aria-hidden="true" /><span role="status">{connectorStatus.label}</span><ArrowUpRight size={14} aria-hidden="true" /></button>
          <div className="topbar-actions">
            <span className="topbar-date">{brokerView ? 'SNAPSHOT TIME SHOWN BELOW' : <>LAST UPDATE <b>·</b> NOT AVAILABLE</>}</span>
            <button className="icon-button unavailable-control" type="button" disabled aria-label="Notifications unavailable in preview" title="Notifications need the application backend"><Bell size={18} /><i /></button>
            <button className="theme-toggle" type="button" onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}<span>{theme === 'dark' ? 'Light' : 'Dark'}</span></button>
            <button className="icon-button signout-button" type="button" onClick={() => void signOut()} aria-label="Sign out" title="Sign out"><LogOut size={18} /></button>
          </div>
        </header>

        {signOutError && <p className="signout-error" role="alert">{signOutError}</p>}

        <AnimatePresence mode="wait" initial={false}>
        <m.div key={`${active}:${active === 'Assistant' ? assistantSource : ''}`} className="content-wrap" initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -4 }} transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}>
          {simulationAvailable === null ? <p role={apiError ? 'alert' : 'status'}>{apiError || 'Checking workspace…'}</p> : active === 'Overview' && simulationAvailable ? <>
            <section className="overview-composition" aria-label="Account overview">
              <div className="overview-hero">
                <div className="overline"><span className="overline-line" />YOUR MARKET DESK <span className="eyebrow-dot" />{apiError ? 'DATA UNAVAILABLE' : 'SIMULATION ACTIVE'}</div>
                <h1><span>Your trading.</span><span>In focus.</span><span>Under control.</span></h1>
                <p className="overview-copy">Monitor your selected account, review the trade journal, explore AI explanations, and keep risk controls in view.</p>
                <div className="overview-actions"><button type="button" className="pill-button pill-button--primary" onClick={() => setActive('Trade History')}>Open trade history <ArrowUpRight size={16} /></button><button type="button" className="pill-button pill-button--secondary" onClick={() => setActive('Assistant')}>Ask the assistant <MessageCircle size={16} /></button></div>
                <div className={`preview-banner overview-banner${apiError ? ' preview-banner--error' : ''}`} role={apiError ? 'alert' : 'note'}><div className="banner-icon"><SlidersHorizontal size={16} /></div><p><strong>{apiError ? 'Simulation unavailable.' : 'Simulation mode.'}</strong> {apiError || 'Fixture data only. No broker orders are placed; live mode is off.'}</p></div>
              </div>
              <div className="overview-rail">
                <article className="overview-metric overview-metric--cream"><div className="overview-metric-label"><span>ACCOUNT BALANCE</span><span className="technical-tag">{account?.balance.currency ?? 'USD'}</span></div><strong className="overview-metric-value">{account ? formatMoney(account.balance.amount) : '—'}</strong><div className="overview-metric-foot"><span>Equity</span><b>{account ? formatMoney(account.equity) : '—'}</b></div><div className="overview-chart-empty">Balance history unavailable</div><small>Time-series data is not provided by this account preview.</small></article>
                <article className="overview-metric overview-metric--navy"><div className="overview-metric-label"><span>OPEN POSITIONS</span><span className="metric-live-tag"><i /> ACCOUNT SCOPED</span></div><strong className="overview-metric-secondary">{String(account?.positions.length ?? 0).padStart(2, '0')}</strong><p>Simulated positions for {account?.label ?? 'the selected account'}.</p><div className="position-symbols">{account?.positions.slice(0, 3).map(({ symbol, side }) => <span key={symbol}><b>{symbol}</b><small>{side}</small></span>) ?? <span><b>—</b><small>No data</small></span>}</div></article>
              </div>
            </section>

            <div className="dashboard-grid">
              <ScoreboardChart range={range} onRangeChange={setRange} />
              <section className="panel risk-panel risk-panel--feature" aria-labelledby="risk-heading">
                <div className="panel-heading">
                  <div><span className="eyebrow">CONTROL ROOM <span className="eyebrow-dot eyebrow-dot--red" /></span><h2 className="panel-title" id="risk-heading">Strategy & risk</h2></div>
                  <span className="neutral-badge"><span />SIMULATED</span>
                </div>
                <div className="connection-card">
                  <div className="connection-emblem"><span className="connection-ring"><Command size={22} /></span><span className={`connection-x${account?.connected ? ' connection-x--online' : ''}`} aria-label={account?.connected ? 'Connected' : 'Offline'}>{account?.connected ? <Check size={10} /> : <X size={10} />}</span></div>
                  <div className="connection-text"><strong>{account?.connected ? 'Simulation connector online' : 'Simulation connector offline'}</strong><span>All account activity remains local fixture data.</span></div>
                </div>
                <div className="risk-stats">
                  <div className="risk-stat"><span className="risk-stat-icon"><Bot size={16} /></span><span>AI decision</span><strong>{account?.latestDecision?.decision ?? 'HOLD'}</strong></div>
                  <div className="risk-stat"><span className="risk-stat-icon"><Gauge size={16} /></span><span>Execution mode</span><strong className="risk-value-muted">Simulation only</strong></div>
                  <div className="risk-stat"><span className="risk-stat-icon"><Clock3 size={16} /></span><span>Daily P&amp;L</span><strong className={account?.dailyPnl !== undefined && account.dailyPnl >= 0 ? 'risk-positive' : 'risk-negative'}>{account ? `${account.dailyPnl >= 0 ? '+' : '−'}${formatMoney(Math.abs(account.dailyPnl))}` : '—'}</strong></div>
                </div>
                <button className="risk-link" type="button" onClick={() => void requestMockReview()} disabled={aiBusy || Boolean(apiError)} aria-describedby="mock-ai-status">{aiBusy ? 'Reviewing…' : 'Run mock AI review'} <Sparkles size={15} /></button>
                <p className="mock-ai-status" id="mock-ai-status" aria-live="polite">{aiMessage}</p>
              </section>
            </div>

            <div className="lower-grid">
              <section className="panel positions-panel" aria-labelledby="positions-heading">
                <div className="panel-heading panel-heading--table">
                  <div><span className="eyebrow">ACCOUNT ACTIVITY</span><h2 className="panel-title" id="positions-heading">Open positions <span className="count-chip">{positions.length.toString().padStart(2, '0')}</span></h2></div>
                  <button className="text-link" type="button" disabled title="Position actions need a connected account">View all <ArrowUpRight size={15} /></button>
                </div>
                <div className="table-preview-label"><span className="sample-dot" />Synthetic simulation fixtures</div>
                <div className="table-scroll" role="region" aria-label="Simulated open positions" tabIndex={0}>
                  <table>
                    <thead><tr><th scope="col">Instrument</th><th scope="col">Side</th><th scope="col">Size</th><th scope="col">Entry</th><th scope="col">Market</th><th scope="col" className="align-right">Unrealized P&L</th></tr></thead>
                    <tbody>{positions.map((item) => <tr key={item.symbol}>
                      <td><span className="instrument-code">{item.symbol}</span><span className="instrument-name">{item.detail}</span></td>
                      <td><span className={`side-badge side-badge--${item.side.toLowerCase()}`}><i />{item.side}</span></td>
                      <td className="numeric">{item.size}</td><td className="numeric">{item.entry}</td><td className="numeric">{item.last}</td>
                      <td className={`numeric align-right pnl-${item.state}`}>{item.pnl} <small>USD</small></td>
                    </tr>)}</tbody>
                  </table>
                </div>
              </section>

              <section className="panel activity-panel" aria-labelledby="activity-heading">
                <div className="panel-heading"><div><span className="eyebrow">THE LOGBOOK</span><h2 className="panel-title" id="activity-heading">Recent activity</h2></div><button className="icon-button more-control" type="button" disabled aria-label="Activity options unavailable"><MoreHorizontal size={19} /></button></div>
                <div className="activity-list">{(account?.events.length ? account.events.map((event, index) => ({ title: event.message, detail: 'Local simulation · just now', icon: index ? ShieldCheck : Activity, tone: index ? 'cream' : 'blue' })) : activities).map(({ title, detail, icon: Icon, tone }) => <article className="activity-item" key={title}>
                  <span className={`activity-icon activity-icon--${tone}`}><Icon size={15} /></span><div><strong>{title}</strong><span>{detail}</span></div>
                </article>)}</div>
                <div className="activity-footer"><span className="footer-rule" /><span>END OF SAMPLE LOG</span><span className="footer-rule" /></div>
              </section>
            </div>

            <footer className="page-footer"><span><span className="footer-mark"><BotifyMark compact /></span>TRADERELAYCITY</span><span>SIMULATION <i /> LIVE MODE DISABLED</span><span>Built for clarity.</span></footer>
          </> : brokerPage ? <>
            <BrokerPage focus={active === 'Positions' ? 'positions' : 'accounts'} />
            <footer className="page-footer"><span><span className="footer-mark"><BotifyMark compact /></span>TRADERELAYCITY</span><span>MT5 READ ONLY <i /> ORDER EXECUTION DISABLED</span><span>Built for clarity.</span></footer>
          </> : active === 'Trade History' ? <>
            {simulationAvailable ? <TradeHistoryPage key={`${userId}:${account?.id ?? 'unavailable'}`} accountId={account?.id ?? ''} accountLabel={account?.label ?? 'Selected account'} currency={account?.balance.currency ?? 'USD'} userId={userId} /> : <SectionPreview active={active} />}
            <footer className="page-footer"><span><span className="footer-mark"><BotifyMark compact /></span>TRADERELAYCITY</span><span>{simulationAvailable ? 'SIMULATION' : 'MT5 READ ONLY'} <i /> LIVE MODE DISABLED</span><span>Built for clarity.</span></footer>
          </> : active === 'Assistant' ? <>
            {simulationAvailable && <div className="assistant-source-switch" role="group" aria-label="Assistant data source"><button type="button" aria-pressed={assistantSource === 'simulation'} onClick={() => setAssistantSource('simulation')}>Simulation records</button><button type="button" aria-pressed={assistantSource === 'broker'} onClick={() => setAssistantSource('broker')}>MT5 snapshots</button></div>}
            {assistantSource === 'broker' ? <BrokerAssistantPage onOpenAccounts={() => setActive('Accounts')} /> : <AssistantPage key={`${userId}:${account?.id ?? 'unavailable'}`} account={account} userId={userId} />}
            <footer className="page-footer"><span><span className="footer-mark"><BotifyMark compact /></span>TRADERELAYCITY</span><span>{assistantSource === 'broker' ? 'MT5 READ ONLY' : 'SIMULATION'} <i /> ORDER EXECUTION DISABLED</span><span>Built for clarity.</span></footer>
          </> : <>
            <div className="page-intro page-intro--simple"><div><div className="overline"><span className="overline-line" />WORKSPACE</div><h1>{active}<span className="title-period">.</span></h1><p className="page-subtitle">TradeRelayCity simulation workspace.</p></div><div className="preview-stamp"><span>SIMULATED</span><span className="stamp-divider" /><time>07 NOV 2026</time></div></div>
            <SectionPreview active={active} />
            <footer className="page-footer"><span><span className="footer-mark"><BotifyMark compact /></span>TRADERELAYCITY</span><span>SIMULATION <i /> LIVE MODE DISABLED</span><span>Built for clarity.</span></footer>
          </>}
        </m.div>
        </AnimatePresence>
      </main>
    </div>
    </LazyMotion>
  )
}

export default App
