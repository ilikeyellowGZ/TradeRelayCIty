import { useState } from 'react'
import { AnimatePresence, LazyMotion, domAnimation, m } from 'motion/react'
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, Bot, BriefcaseBusiness,
  ChartNoAxesCombined, ChevronDown, CircleHelp, Clock3, Command, FlaskConical,
  Gauge, LayoutDashboard, Menu, MoreHorizontal, PanelLeftClose,
  ShieldCheck, SlidersHorizontal, Sparkles, TrendingUp, WalletCards, X,
} from 'lucide-react'
import { BotifyMark } from './components/BotifyMark'
import { ScoreboardChart } from './components/ScoreboardChart'

const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Accounts', icon: WalletCards },
  { label: 'Bots & Strategies', icon: Bot },
  { label: 'Positions', icon: BriefcaseBusiness },
  { label: 'Trade History', icon: Activity },
  { label: 'Backtests', icon: FlaskConical },
  { label: 'Risk Settings', icon: ShieldCheck },
  { label: 'Notifications', icon: Bell },
]

const positions = [
  { symbol: 'EURUSD', detail: 'Euro / US Dollar', side: 'Buy', size: '0.12', entry: '1.08420', last: '1.08634', pnl: '+25.68', state: 'positive' },
  { symbol: 'GBPUSD', detail: 'British Pound / US Dollar', side: 'Sell', size: '0.08', entry: '1.27150', last: '1.27310', pnl: '−12.80', state: 'negative' },
  { symbol: 'XAUUSD', detail: 'Gold / US Dollar', side: 'Buy', size: '0.03', entry: '2,331.80', last: '2,338.10', pnl: '+18.90', state: 'positive' },
]

const activities = [
  { title: 'Account snapshot refreshed', detail: 'Illustrative preview · just now', icon: Activity, tone: 'blue' },
  { title: 'Risk profile reviewed', detail: 'Preview state · 18 min ago', icon: ShieldCheck, tone: 'cream' },
  { title: 'Strategy workspace opened', detail: 'No broker connection · 42 min ago', icon: Bot, tone: 'red' },
]

function Sidebar({ active, onNavigate, open, onClose }: { active: string; onNavigate: (name: string) => void; open: boolean; onClose: () => void }) {
  return (
    <>
      <AnimatePresence>
        {open && <m.button className="drawer-scrim" aria-label="Close navigation" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />}
      </AnimatePresence>
      <m.aside className={`sidebar${open ? ' sidebar--open' : ''}`} aria-label="Main navigation" initial={false} animate={{ x: open || window.innerWidth >= 1024 ? 0 : -272 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
        <div className="sidebar-top">
          <button className="brand-link" type="button" onClick={() => { onNavigate('Overview'); onClose() }} aria-label="Botify overview">
            <BotifyMark />
            <span className="brand-edition">TRADING DESK <i /></span>
          </button>
          <button className="mobile-close icon-button" type="button" onClick={onClose} aria-label="Close navigation"><X size={19} /></button>
        </div>

        <div className="workspace-label">WORKSPACE <span>01</span></div>
        <nav className="primary-nav">
          {navItems.map(({ label, icon: Icon }, index) => (
            <button key={label} type="button" className={`nav-item${active === label ? ' nav-item--active' : ''}${index === 1 || index === 5 ? ' nav-item--break' : ''}`} aria-current={active === label ? 'page' : undefined} onClick={() => { onNavigate(label); onClose() }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === 'Notifications' && <span className="nav-count">2</span>}
            </button>
          ))}
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
      </m.aside>
    </>
  )
}

function MetricCard({ label, value, caption, icon: Icon, tone, change }: { label: string; value: string; caption: string; icon: typeof WalletCards; tone: string; change?: 'up' | 'down' }) {
  return (
    <m.article className="metric-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, ease: 'easeOut' }}>
      <div className={`metric-icon metric-icon--${tone}`}><Icon size={18} strokeWidth={1.9} /></div>
      <div className="metric-content">
        <div className="metric-label">{label}<span className="sample-dot" /></div>
        <div className="metric-value">{value}</div>
        <div className="metric-caption">{change === 'up' ? <ArrowUpRight size={14} /> : change === 'down' ? <ArrowDownRight size={14} /> : null}{caption}</div>
      </div>
      <span className="metric-corner" aria-hidden="true" />
    </m.article>
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
  const [active, setActive] = useState('Overview')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [range, setRange] = useState('1W')
  const [accountOpen, setAccountOpen] = useState(false)

  return (
    <LazyMotion features={domAnimation}>
    <div className="app-shell">
      <Sidebar active={active} onNavigate={setActive} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" type="button" onClick={() => setDrawerOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="topbar-account">
            <button className="account-switcher" type="button" aria-expanded={accountOpen} onClick={() => setAccountOpen((value) => !value)}>
              <span className="account-avatar"><Command size={16} /></span>
              <span className="account-labels"><strong>Primary demo account</strong><small>Preview workspace</small></span>
              <ChevronDown size={16} className={accountOpen ? 'chevron-open' : ''} />
            </button>
            <AnimatePresence>
              {accountOpen && <m.div className="account-menu" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}>
                <strong>Preview account</strong><span>No MT5 account is connected.</span><button type="button" onClick={() => setAccountOpen(false)}>Close</button>
              </m.div>}
            </AnimatePresence>
          </div>
          <div className="topbar-state"><span className="mode-badge"><span />DEMO</span><span className="state-divider" /><span className="connection-dot" /><span className="connection-copy">Preview · not connected</span></div>
          <div className="topbar-actions">
            <span className="topbar-date">SATURDAY <b>·</b> NOV 07</span>
            <button className="icon-button unavailable-control" type="button" disabled aria-label="Notifications unavailable in preview" title="Notifications need the application backend"><Bell size={18} /><i /></button>
            <button className="topbar-help" type="button" disabled><CircleHelp size={16} /><span>Help</span></button>
          </div>
        </header>

        <div className="content-wrap">
          {active === 'Overview' ? <>
            <div className="page-intro">
              <div><div className="overline"><span className="overline-line" />YOUR MARKET DESK</div><h1>Overview<span className="title-period">.</span></h1><p className="page-subtitle">A clear view of your account, strategies, and risk.</p></div>
              <div className="preview-stamp"><Sparkles size={14} /><span>VISUAL PREVIEW</span><span className="stamp-divider" /><time>07 NOV 2026</time></div>
            </div>

            <div className="preview-banner" role="note">
              <div className="banner-icon"><SlidersHorizontal size={16} /></div>
              <p><strong>Preview mode.</strong> All figures and chart data are illustrative. No broker connection or trading actions are active.</p>
              <span className="banner-end" aria-hidden="true" />
            </div>

            <section className="metrics-grid" aria-label="Account metrics, illustrative values">
              <MetricCard label="Balance" value="$24,580.00" caption="Account currency · USD" icon={WalletCards} tone="blue" />
              <MetricCard label="Equity" value="$24,764.32" caption="Includes open position P&L" icon={ChartNoAxesCombined} tone="navy" />
              <MetricCard label="Today's realized P&L" value="+$184.32" caption="Illustrative daily result" icon={TrendingUp} tone="red" change="up" />
              <MetricCard label="Open positions" value="03" caption="Sample rows · not live" icon={BriefcaseBusiness} tone="cream" />
            </section>

            <div className="dashboard-grid">
              <ScoreboardChart range={range} onRangeChange={setRange} />
              <section className="panel risk-panel" aria-labelledby="risk-heading">
                <div className="panel-heading">
                  <div><span className="eyebrow">CONTROL ROOM <span className="eyebrow-dot eyebrow-dot--red" /></span><h2 className="panel-title" id="risk-heading">Strategy & risk</h2></div>
                  <span className="neutral-badge"><span />PREVIEW</span>
                </div>
                <div className="connection-card">
                  <div className="connection-emblem"><span className="connection-ring"><Command size={22} /></span><span className="connection-x">×</span></div>
                  <div className="connection-text"><strong>No live connection</strong><span>Broker and strategy services are not configured.</span></div>
                </div>
                <div className="risk-stats">
                  <div className="risk-stat"><span className="risk-stat-icon"><Bot size={16} /></span><span>Active strategies</span><strong>—</strong></div>
                  <div className="risk-stat"><span className="risk-stat-icon"><Gauge size={16} /></span><span>Risk policy</span><strong className="risk-value-muted">Not set</strong></div>
                  <div className="risk-stat"><span className="risk-stat-icon"><Clock3 size={16} /></span><span>Last update</span><strong className="risk-value-muted">—</strong></div>
                </div>
                <button className="risk-link" type="button" disabled title="Risk settings need the application backend">Risk settings <PanelLeftClose size={15} /></button>
              </section>
            </div>

            <div className="lower-grid">
              <section className="panel positions-panel" aria-labelledby="positions-heading">
                <div className="panel-heading panel-heading--table">
                  <div><span className="eyebrow">ACCOUNT ACTIVITY</span><h2 className="panel-title" id="positions-heading">Open positions <span className="count-chip">03</span></h2></div>
                  <button className="text-link" type="button" disabled title="Position actions need a connected account">View all <ArrowUpRight size={15} /></button>
                </div>
                <div className="table-preview-label"><span className="sample-dot" />Sample data · illustrative only</div>
                <div className="table-scroll" role="region" aria-label="Illustrative open positions" tabIndex={0}>
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
                <div className="activity-list">{activities.map(({ title, detail, icon: Icon, tone }) => <article className="activity-item" key={title}>
                  <span className={`activity-icon activity-icon--${tone}`}><Icon size={15} /></span><div><strong>{title}</strong><span>{detail}</span></div>
                </article>)}</div>
                <div className="activity-footer"><span className="footer-rule" /><span>END OF SAMPLE LOG</span><span className="footer-rule" /></div>
              </section>
            </div>

            <footer className="page-footer"><span><span className="footer-mark"><BotifyMark compact /></span>BOTIFY TRADING DESK</span><span>FRONTEND PREVIEW <i /> NO LIVE DATA</span><span>Built for clarity.</span></footer>
          </> : <>
            <div className="page-intro page-intro--simple"><div><div className="overline"><span className="overline-line" />WORKSPACE</div><h1>{active}<span className="title-period">.</span></h1><p className="page-subtitle">Botify account workspace preview.</p></div><div className="preview-stamp"><span>VISUAL PREVIEW</span><span className="stamp-divider" /><time>07 NOV 2026</time></div></div>
            <SectionPreview active={active} />
            <footer className="page-footer"><span><span className="footer-mark"><BotifyMark compact /></span>BOTIFY TRADING DESK</span><span>FRONTEND PREVIEW <i /> NO LIVE DATA</span><span>Built for clarity.</span></footer>
          </>}
        </div>
      </main>
    </div>
    </LazyMotion>
  )
}

export default App
