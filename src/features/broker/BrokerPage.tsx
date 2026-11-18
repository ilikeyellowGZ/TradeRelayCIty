import { useEffect, useState } from 'react'
import { Activity, Check, Copy, Link2, RefreshCw, ShieldCheck, Unplug, X } from 'lucide-react'
import './broker.css'

type Device = { id: string; name: string; createdAt: number; lastSeenAt: number | null; revokedAt: number | null; broker: string | null; server: string | null; login: string | null; environment: 'DEMO' | 'LIVE' | null }
type Position = { ticket: string; symbol: string; side: 'BUY' | 'SELL'; volume: number; priceOpen: number; priceCurrent: number; profit: number; stop: number | null; target: number | null }
type BrokerAccount = { id: string; deviceId: string; broker: string; server: string; login: string; environment: 'DEMO' | 'LIVE'; currency: string; balance: number | null; equity: number | null; marginUsed: number | null; marginFree: number | null; floatingProfit: number | null; positions: Position[]; observedAt: string | null; receivedAt: number | null; stale: boolean }

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status}).`)
  return data
}

function money(value: number | null, currency: string): string {
  if (value === null) return '—'
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value) }
  catch { return `${value.toFixed(2)} ${currency}` }
}

export function BrokerPage({ focus = 'accounts' }: { focus?: 'accounts' | 'positions' }) {
  const [devices, setDevices] = useState<Device[]>([])
  const [accounts, setAccounts] = useState<BrokerAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState<{ value: string; expiresAt: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmDeviceId, setConfirmDeviceId] = useState<string | null>(null)

  async function refresh() {
    try {
      const [deviceData, accountData] = await Promise.all([
        fetch('/api/broker/devices', { cache: 'no-store' }).then((response) => readJson<{ devices: Device[] }>(response)),
        fetch('/api/broker/accounts', { cache: 'no-store' }).then((response) => readJson<{ accounts: BrokerAccount[] }>(response)),
      ])
      setDevices(deviceData.devices)
      setAccounts(accountData.accounts)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Broker data is unavailable.')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  async function createCode() {
    setBusy(true)
    setError('')
    setCopied(false)
    try {
      const result = await readJson<{ code: string; expiresAt: string }>(await fetch('/api/broker/pairing-codes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }))
      setCode({ value: result.code, expiresAt: result.expiresAt })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create a pairing code.')
    } finally { setBusy(false) }
  }

  async function copyCode() {
    if (!code) return
    try { await navigator.clipboard.writeText(code.value); setCopied(true) }
    catch { setError('Copy failed. Select the code and copy it manually.') }
  }

  async function revokeDevice(id: string) {
    setBusy(true)
    setError('')
    try {
      await readJson<{ revoked: boolean }>(await fetch(`/api/broker/devices/${encodeURIComponent(id)}`, { method: 'DELETE' }))
      setConfirmDeviceId(null)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not revoke the device.')
    } finally { setBusy(false) }
  }

  const activeDevices = devices.filter((device) => device.revokedAt === null)
  return <section className="broker-page" aria-labelledby="broker-title">
    <div className="page-intro page-intro--simple broker-intro">
      <div><div className="overline"><span className="overline-line" />CONNECTED WORKSPACE</div><h1 id="broker-title">{focus === 'positions' ? 'Broker positions' : 'Broker accounts'}<span className="title-period">.</span></h1><p className="page-subtitle">MT5 account snapshots from your paired Windows connector. Read only; order execution is disabled.</p></div>
      <button className="pill-button pill-button--secondary broker-refresh" type="button" onClick={() => void refresh()} disabled={loading || busy}><RefreshCw size={17} />Refresh</button>
    </div>

    <div className="broker-state-note" role="note"><ShieldCheck size={19} /><span>Broker values are shown only when a paired connector uploads them. The timestamp and stale label tell you when a snapshot was observed. No order can be placed here.</span></div>
    {error && <p className="broker-error" role="alert">{error}</p>}

    {focus === 'accounts' && <div className="broker-grid">
      <article className="panel broker-panel">
        <div className="broker-panel-heading"><div><span className="eyebrow">SECURE CONNECTION</span><h2>Pair a Windows connector</h2></div><Link2 size={22} aria-hidden="true" /></div>
        <p>Open the connector on the same PC as MT5. Create a code here, then paste it into the connector within 10 minutes.</p>
        <button className="pill-button pill-button--primary" type="button" onClick={() => void createCode()} disabled={busy}>{busy ? 'Creating…' : 'Create pairing code'}</button>
        {code && <div className="broker-code-box" aria-live="polite"><span>One-time code</span><div><code>{code.value}</code><button type="button" onClick={() => void copyCode()} aria-label="Copy pairing code">{copied ? <Check size={18} /> : <Copy size={18} />}{copied ? 'Copied' : 'Copy'}</button></div><small>Expires {new Date(code.expiresAt).toLocaleString()}. Creating another code invalidates this one.</small></div>}
      </article>
      <article className="panel broker-panel">
        <div className="broker-panel-heading"><div><span className="eyebrow">DEVICE ACCESS</span><h2>Paired devices</h2></div><span className="broker-count">{activeDevices.length}</span></div>
        {loading ? <p role="status">Loading devices…</p> : devices.length === 0 ? <div className="broker-empty"><Unplug size={23} /><p>No connector is paired yet.</p></div> : <ul className="broker-device-list">{devices.map((device) => <li key={device.id}><div><strong>{device.name}</strong><span>{device.broker ? `${device.broker} · ${device.server} · ${device.login}` : 'No MT5 account snapshot yet'}</span><small>{device.revokedAt ? 'Revoked' : device.lastSeenAt ? `Last seen ${new Date(device.lastSeenAt).toLocaleString()}` : 'Paired; waiting for first sync'}</small></div>{!device.revokedAt && (confirmDeviceId === device.id ? <div className="broker-device-actions"><button type="button" onClick={() => void revokeDevice(device.id)} disabled={busy}>Confirm revoke</button><button type="button" onClick={() => setConfirmDeviceId(null)}>Cancel</button></div> : <button type="button" onClick={() => setConfirmDeviceId(device.id)}>Revoke</button>)}</li>)}</ul>}
      </article>
    </div>}

    <div className="broker-account-heading"><div><span className="eyebrow">MT5 SNAPSHOTS</span><h2>{focus === 'positions' ? 'Open broker positions' : 'Account balances and positions'}</h2></div><span>{accounts.length} account{accounts.length === 1 ? '' : 's'}</span></div>
    {loading ? <div className="panel broker-panel" role="status">Loading broker snapshots…</div> : accounts.length === 0 ? <div className="panel broker-panel broker-empty"><Activity size={25} /><h3>No broker snapshot yet</h3><p>Pair the Windows connector and run “Sync MT5 snapshot (read only)” to show the account here.</p></div> : accounts.map((account) => <article className="panel broker-account" key={account.id}>
      <div className="broker-account-top"><div><span className="eyebrow">{account.environment} ACCOUNT · READ ONLY</span><h3>{account.broker}</h3><p>{account.server} · Login {account.login}</p></div><span className={`broker-freshness${account.stale ? ' broker-freshness--stale' : ''}`}>{account.stale ? 'Stale snapshot' : 'Recent snapshot'}</span></div>
      <div className="broker-metrics"><div><span>Balance</span><strong>{money(account.balance, account.currency)}</strong></div><div><span>Equity</span><strong>{money(account.equity, account.currency)}</strong></div><div><span>Floating P&amp;L</span><strong>{money(account.floatingProfit, account.currency)}</strong></div><div><span>Used margin</span><strong>{money(account.marginUsed, account.currency)}</strong></div><div><span>Free margin</span><strong>{money(account.marginFree, account.currency)}</strong></div><div><span>Open positions</span><strong>{account.positions.length.toString().padStart(2, '0')}</strong></div></div>
      <p className="broker-observed">{account.observedAt ? `Observed ${new Date(account.observedAt).toLocaleString()} · ${account.stale ? 'Values may have changed since this snapshot.' : 'Refreshes when the connector syncs.'}` : 'Waiting for first account snapshot.'}</p>
      <div className="broker-table-wrap" role="region" aria-label={`Open positions for ${account.broker} account ${account.login}`} tabIndex={0}><table><thead><tr><th scope="col">Symbol</th><th scope="col">Side</th><th scope="col">Volume</th><th scope="col">Open</th><th scope="col">Current</th><th scope="col">Stop</th><th scope="col">Target</th><th scope="col">P&amp;L</th></tr></thead><tbody>{account.positions.length ? account.positions.map((position) => <tr key={position.ticket}><td><strong>{position.symbol}</strong><small>#{position.ticket}</small></td><td>{position.side}</td><td>{position.volume}</td><td>{position.priceOpen}</td><td>{position.priceCurrent}</td><td>{position.stop ?? '—'}</td><td>{position.target ?? '—'}</td><td className={position.profit >= 0 ? 'broker-profit' : 'broker-loss'}>{money(position.profit, account.currency)}</td></tr>) : <tr><td colSpan={8}>No open positions in this snapshot.</td></tr>}</tbody></table></div>
    </article>)}
    <footer className="broker-footer"><X size={15} /> Demo and live order execution remain disabled.</footer>
  </section>
}
