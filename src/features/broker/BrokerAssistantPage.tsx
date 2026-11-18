import { useEffect, useState, type FormEvent } from 'react'
import { ArrowUpRight, ShieldCheck } from 'lucide-react'
import { AiQuestionOption, useAiCapability } from '../../components/AiQuestionOption'
import './broker.css'

type Account = { id: string; broker: string; server: string; login: string; environment: 'DEMO' | 'LIVE'; observedAt: string | null; stale: boolean }
type Answer = { answer: string; observedAt: string; stale: boolean; source: 'MT5_ACCOUNT_SNAPSHOT'; mode: 'BROKER_READ_ONLY'; supported: boolean; classification?: 'AI_INTENT' | 'UNAVAILABLE'; classifier?: { provider: string; model: string } }
export function BrokerAssistantPage({ onOpenAccounts }: { onOpenAccounts: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selected, setSelected] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const aiCapability = useAiCapability('broker')
  const [useAi, setUseAi] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/broker/accounts', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const failure = await response.json() as { error?: string }
          throw new Error(failure.error ?? 'Could not load MT5 snapshots.')
        }
        const data = await response.json() as { accounts?: Account[]; error?: string }
        if (!data.accounts) throw new Error(data.error ?? 'Could not load MT5 snapshots.')
        setAccounts(data.accounts)
        setSelected((current) => current || data.accounts?.[0]?.id || '')
      })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load MT5 snapshots.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const clean = question.trim()
    if (!selected || !clean || clean.length > 500) return
    setBusy(true)
    setError('')
    setAnswer(null)
    try {
      const endpoint = useAi && aiCapability?.available ? 'ai-questions' : 'questions'
      const response = await fetch(`/api/broker/accounts/${encodeURIComponent(selected)}/${endpoint}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: clean }),
      })
      const data = await response.json() as Answer & { error?: string }
      if (!response.ok) throw new Error(data.error ?? 'Could not answer from this snapshot.')
      setAnswer(data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not answer from this snapshot.')
    } finally { setBusy(false) }
  }

  const chosen = accounts.find((account) => account.id === selected)
  return <section className="broker-page broker-assistant" aria-labelledby="broker-assistant-title">
    <div className="page-intro page-intro--simple broker-intro">
      <div><div className="overline"><span className="overline-line" />READ-ONLY RECORDS</div><h1 id="broker-assistant-title">MT5 account answers<span className="title-period">.</span></h1><p className="page-subtitle">Ask about a paired account snapshot. Answers cite its observation time and use only stored MT5 values.</p></div>
      <button type="button" className="pill-button pill-button--secondary broker-refresh" onClick={onOpenAccounts}>Manage connection <ArrowUpRight size={16} /></button>
    </div>
    <div className="broker-state-note" role="note"><ShieldCheck size={19} /><span>Snapshot facts are rendered from stored MT5 values. The optional AI classifier interprets the question only; it cannot call trading tools. Questions needing history, market data, or a strategy test receive an unavailable answer.</span></div>
    {error && <p role="alert" className="broker-error">{error}</p>}
    <div className="panel broker-panel broker-assistant-panel">
      {loading ? <p role="status">Loading MT5 accounts…</p> : accounts.length === 0 ? <div className="broker-empty"><h2>No broker snapshot yet</h2><p>Pair the Windows connector and sync an MT5 account first.</p></div> : <>
        <label htmlFor="broker-assistant-account">Account snapshot</label>
        <select id="broker-assistant-account" value={selected} onChange={(event) => { setSelected(event.target.value); setAnswer(null) }}>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.broker} · {account.server} · {account.environment} · {account.login}</option>)}
        </select>
        <p className="broker-assistant-time">{chosen?.observedAt ? `Observed ${new Date(chosen.observedAt).toLocaleString()}${chosen.stale ? ' · Stale snapshot' : ''}` : 'No observation time available'}</p>
        <form onSubmit={(event) => void ask(event)}>
          <label htmlFor="broker-assistant-question">Your question</label>
          <textarea id="broker-assistant-question" maxLength={500} rows={3} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What is my current account balance?" />
          <AiQuestionOption capability={aiCapability} checked={useAi} busy={busy} onChange={setUseAi} />
          <button className="pill-button pill-button--primary" type="submit" disabled={busy || !question.trim()}>{busy ? 'Checking snapshot…' : 'Ask about snapshot'}</button>
        </form>
        <p className="broker-assistant-examples">Try: “What is my balance?” · “Show my EUR/USD positions” · “What is my floating P&amp;L?”</p>
        {answer && <article className="broker-answer" aria-live="polite"><span>{answer.supported ? 'SNAPSHOT ANSWER' : 'DATA UNAVAILABLE'}</span><p>{answer.answer}</p><small>Source: MT5 account snapshot · {answer.mode}{answer.stale ? ' · Stale' : ''}{answer.classification === 'AI_INTENT' && answer.classifier ? ` · Question classified by ${answer.classifier.provider} (${answer.classifier.model})` : ''}</small></article>}
      </>}
    </div>
  </section>
}
