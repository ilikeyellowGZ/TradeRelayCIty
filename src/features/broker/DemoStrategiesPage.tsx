import { useEffect, useState } from 'react'
import { Bot, Check, ShieldCheck, Sparkles } from 'lucide-react'
import './broker.css'

type Config = { type: 'sweep_fvg_v1'; symbol: 'EURUSD'; sweepLookback: number; displacementAtr: number; minGapAtr: number; rewardRisk: number }
type Account = { id: string; broker: string; server: string; login: string; environment: 'DEMO' | 'LIVE'; observedAt: string | null; stale: boolean }
type Strategy = { id: string; name: string; config: Config; active: boolean; updatedAt: number }
const initial: Config = { type: 'sweep_fvg_v1', symbol: 'EURUSD', sweepLookback: 8, displacementAtr: 1.2, minGapAtr: 0.1, rewardRisk: 2 }

async function json<T>(response: Response): Promise<T> {
  const value = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(value.error || `Request failed (${response.status}).`)
  return value
}

export function DemoStrategiesPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState('')
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [name, setName] = useState('EURUSD sweep and FVG')
  const [config, setConfig] = useState<Config>(initial)
  const [description, setDescription] = useState('')
  const [draftExplanation, setDraftExplanation] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function refresh(id: string) {
    const result = await json<{ strategies: Strategy[] }>(await fetch(`/api/broker/accounts/${encodeURIComponent(id)}/strategies`, { cache: 'no-store' }))
    setStrategies(result.strategies)
  }
  useEffect(() => {
    let alive = true
    void fetch('/api/broker/accounts', { cache: 'no-store' }).then((response) => json<{ accounts: Account[] }>(response)).then((result) => {
      if (!alive) return
      const demos = result.accounts.filter((account) => account.environment === 'DEMO')
      setAccounts(result.accounts)
      setAccountId(demos[0]?.id ?? '')
    }).catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : 'Accounts unavailable.') }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])
  useEffect(() => {
    if (!accountId) { setStrategies([]); return }
    let alive = true
    void fetch(`/api/broker/accounts/${encodeURIComponent(accountId)}/strategies`, { cache: 'no-store' }).then((response) => json<{ strategies: Strategy[] }>(response)).then((result) => { if (alive) setStrategies(result.strategies) }).catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : 'Strategies unavailable.') })
    return () => { alive = false }
  }, [accountId])

  async function act(action: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('')
    try { await action(); await refresh(accountId) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Strategy request failed.') }
    finally { setBusy(false) }
  }
  const update = (key: keyof Config, value: string) => setConfig((previous) => ({ ...previous, [key]: Number(value) }))
  const demoAccounts = accounts.filter((account) => account.environment === 'DEMO')
  const liveAccounts = accounts.filter((account) => account.environment === 'LIVE')
  const fields: { key: 'sweepLookback' | 'displacementAtr' | 'minGapAtr' | 'rewardRisk'; label: string; help: string; min: number; max: number; step: number }[] = [
    { key: 'sweepLookback', label: 'Sweep window', help: 'Recent closed M15 bars searched for a liquidity sweep.', min: 4, max: 16, step: 1 },
    { key: 'displacementAtr', label: 'Displacement strength', help: 'Minimum candle body as a multiple of ATR.', min: 0.8, max: 2, step: 0.1 },
    { key: 'minGapAtr', label: 'Fair value gap size', help: 'Minimum closed-bar gap as a multiple of ATR.', min: 0.05, max: 0.3, step: 0.01 },
    { key: 'rewardRisk', label: 'Reward to risk', help: 'Target distance relative to stop distance.', min: 1.5, max: 3, step: 0.1 },
  ]

  return <section className="broker-page strategy-page" aria-labelledby="strategy-title">
    <div className="page-intro page-intro--simple broker-intro"><div><div className="overline"><span className="overline-line" />DEMO AUTOMATION</div><h1 id="strategy-title">Bots &amp; Strategies<span className="title-period">.</span></h1><p className="page-subtitle">Create a EURUSD strategy, activate it for your paired DEMO account, then run the Windows connector bot.</p></div></div>
    <div className="broker-state-note" role="note"><ShieldCheck size={19} /><span>Activation only selects the setup rules. The Windows connector must still be armed. A cycle can return HOLD when no closed-bar setup or AI approval exists. LIVE entries remain disabled.</span></div>
    {error && <p className="broker-error" role="alert">{error}</p>}
    {notice && <p className="strategy-notice" role="status"><Check size={18} />{notice}</p>}
    {liveAccounts.length > 0 && <article className="panel broker-panel" aria-label="Live account readiness"><div className="broker-panel-heading"><div><span className="eyebrow">LIVE ACCOUNT STATUS</span><h2>Live accounts are read only</h2></div><ShieldCheck size={22} aria-hidden="true" /></div><p>These accounts can sync snapshots. Automatic live orders are unavailable until the demo order flow and each live account's broker settings pass validation.</p><ul className="broker-device-list">{liveAccounts.map((account) => <li key={account.id}><div><strong>{account.broker} · {account.server}</strong><span>LIVE · Login {account.login}</span><small>{account.observedAt ? `${account.stale ? 'Stale snapshot' : 'Last snapshot'} · ${new Date(account.observedAt).toLocaleString()}` : 'Waiting for a snapshot'}</small></div></li>)}</ul></article>}
    {loading ? <p>Loading paired accounts…</p> : demoAccounts.length === 0 ? <article className="panel broker-panel"><h2>Pair a DEMO account first</h2><p>Open Accounts, pair the Windows connector, and sync an MT5 DEMO snapshot. Your strategy will then be bound to that account.</p></article> : <>
      <label className="strategy-account">DEMO account<select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{demoAccounts.map((account) => <option key={account.id} value={account.id}>{account.broker} · {account.server} · {account.login}</option>)}</select></label>
      <div className="strategy-grid">
        <div className="panel strategy-ai"><div className="broker-panel-heading"><div><span className="eyebrow">AI ASSISTED DRAFT</span><h2>Describe your setup</h2></div><Sparkles size={22} aria-hidden="true" /></div><p>Describe how selective you want the EURUSD sweep and FVG setup to be. AI can suggest settings for this template; it cannot add new indicators or trade directly.</p><label htmlFor="strategy-description">Your strategy idea</label><textarea id="strategy-description" value={description} onChange={(event) => setDescription(event.target.value)} minLength={20} maxLength={1000} rows={4} placeholder="For EURUSD demo, use a stronger displacement candle and a wider fair value gap, with a 2:1 target." /><button type="button" className="pill-button pill-button--secondary" disabled={busy || description.trim().length < 20} onClick={() => void act(async () => { const draft = await json<{ name: string; config: Config; explanation: string; provider: string }>(await fetch(`/api/broker/accounts/${encodeURIComponent(accountId)}/strategies/draft`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ description }) })); setName(draft.name); setConfig(draft.config); setDraftExplanation(draft.explanation); setNotice('AI draft loaded into the editor. Review it, save it, then activate it.') })}>{busy ? 'Drafting…' : 'Draft with AI'}</button>{draftExplanation && <p className="strategy-ai-explanation">{draftExplanation}</p>}</div>
        <form className="panel strategy-editor" onSubmit={(event) => { event.preventDefault(); void act(async () => {
          await json(await fetch(`/api/broker/accounts/${encodeURIComponent(accountId)}/strategies`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, config }) }))
          setNotice('Strategy saved as a draft. Activate it below to use it in the connector.')
        }) }}>
          <div className="broker-panel-heading"><div><span className="eyebrow">CLOSED BAR RULES</span><h2>Create a strategy</h2></div><Bot size={22} aria-hidden="true" /></div>
          <p className="strategy-help">EURUSD · M15 entry · H1 trend. The connector checks a sweep, displacement, and fair value gap before asking AI for approval.</p>
          <label>Strategy name<input value={name} onChange={(event) => setName(event.target.value)} minLength={3} maxLength={60} required /></label>
          <div className="strategy-fields">{fields.map((field) => <label key={field.key}>{field.label}<input type="number" value={config[field.key]} min={field.min} max={field.max} step={field.step} onChange={(event) => update(field.key, event.target.value)} required /><small>{field.help}</small></label>)}</div>
          <button className="pill-button pill-button--primary" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save strategy draft'}</button>
        </form>
        <div className="panel strategy-list"><div className="broker-panel-heading"><div><span className="eyebrow">ACCOUNT SETUPS</span><h2>Saved strategies</h2></div><span className="broker-count">{strategies.length}</span></div>
          {strategies.length === 0 ? <p>No strategies yet. Save one, then activate it.</p> : <ul>{strategies.map((strategy) => <li key={strategy.id}><div><strong>{strategy.name}</strong><small>EURUSD · sweep {strategy.config.sweepLookback} bars · {strategy.config.rewardRisk}:1 target</small><span className={strategy.active ? 'strategy-active' : 'strategy-draft'}>{strategy.active ? 'Active for DEMO bot' : 'Draft'}</span></div><div className="strategy-actions"><button type="button" disabled={busy} onClick={() => { setName(strategy.name + ' copy'); setConfig(strategy.config) }}>Use settings</button>{strategy.active ? <button type="button" disabled={busy} onClick={() => void act(async () => { await json(await fetch(`/api/broker/accounts/${encodeURIComponent(accountId)}/strategies/deactivate`, { method: 'POST' })); setNotice('Strategy deactivated. Bot cycles will HOLD.') })}>Deactivate</button> : <button type="button" disabled={busy} onClick={() => void act(async () => { await json(await fetch(`/api/broker/accounts/${encodeURIComponent(accountId)}/strategies/${encodeURIComponent(strategy.id)}/activate`, { method: 'POST' })); setNotice(`${strategy.name} is active for this DEMO account.`) })}>Activate</button>}</div></li>)}</ul>}
        </div>
      </div>
      <div className="broker-state-note"><Sparkles size={19} /><span>AI reviews a confirmed candidate during each bot cycle. The strategy editor sets deterministic rules; AI does not place orders or guarantee a BUY or SELL.</span></div>
    </>}
  </section>
}
