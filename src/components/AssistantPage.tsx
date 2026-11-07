import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Bot, MessageCircle, Plus, Send, Trash2, X } from 'lucide-react'

type Account = { id: string; label: string; connected: boolean; environment: string; mode: string }
type Message = { id: string; role: 'user' | 'assistant'; content: string; citations: string[]; simulated?: boolean }
type Conversation = { id: string; accountId: string; title: string; expiresAt?: string; messages?: Message[] }

const starters = ['Show my last ten trades.', 'Why did this trade lose?', 'Which trades were rejected and why?', 'What has the bot learned this week?', 'Why did it skip this setup?', 'What is the bot doing now?', 'How much of my AI allowance is left?', 'What order types can this account use?']

export function AssistantPage({ account, userId }: { account: Account | null; userId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const headers = { 'content-type': 'application/json', 'x-simulation-user': userId }

  const loadConversations = useCallback(async (signal?: AbortSignal) => {
    if (!account) return
    const response = await fetch(`/api/simulation/chat?accountId=${encodeURIComponent(account.id)}`, { headers, signal })
    if (!response.ok) throw new Error((await response.json() as { error?: string }).error ?? 'Could not load conversations.')
    const data = await response.json() as { conversations: Conversation[] }
    setConversations(data.conversations)
  }, [account?.id, userId])

  useEffect(() => {
    const controller = new AbortController()
    setConversation(null)
    setConversations([])
    setError('')
    void loadConversations(controller.signal).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Assistant is offline.')
    })
    return () => { controller.abort(); abortRef.current?.abort() }
  }, [loadConversations])

  async function createConversation(firstMessage?: string) {
    if (!account) return
    setError('')
    const response = await fetch('/api/simulation/chat', { method: 'POST', headers, body: JSON.stringify({ accountId: account.id }) })
    const data = await response.json() as { conversation?: Conversation; error?: string }
    if (!response.ok || !data.conversation) throw new Error(data.error ?? 'Could not start a conversation.')
    setConversation(data.conversation)
    setConversations((items) => [data.conversation!, ...items])
    if (firstMessage) await sendMessage(firstMessage, data.conversation)
  }

  async function openConversation(item: Conversation) {
    setError('')
    try {
      const response = await fetch(`/api/simulation/chat/${encodeURIComponent(item.id)}`, { headers })
      const data = await response.json() as { conversation?: Conversation; error?: string }
      if (!response.ok || !data.conversation) throw new Error(data.error ?? 'Could not open conversation.')
      setConversation(data.conversation)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not open conversation.') }
  }

  async function deleteConversation(id: string) {
    try {
      const response = await fetch(`/api/simulation/chat/${encodeURIComponent(id)}`, { method: 'DELETE', headers })
      if (!response.ok) throw new Error('Could not delete conversation.')
      setConversations((items) => items.filter((item) => item.id !== id))
      if (conversation?.id === id) setConversation(null)
      setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete conversation.') }
  }

  async function sendMessage(content: string, target = conversation) {
    const clean = content.trim()
    if (!clean || !target) return
    setBusy(true)
    setError('')
    setDraft('')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const response = await fetch(`/api/simulation/chat/${encodeURIComponent(target.id)}/messages`, { method: 'POST', headers, body: JSON.stringify({ content: clean }), signal: controller.signal })
      const data = await response.json() as { messages?: Message[]; error?: string }
      if (!response.ok || !data.messages) throw new Error(data.error ?? 'The simulated assistant is unavailable.')
      setConversation((current) => current?.id === target.id ? { ...current, title: current.title === 'New conversation' ? clean.slice(0, 80) : current.title, messages: [...(current.messages ?? []), ...data.messages!] } : current)
      setConversations((items) => items.map((item) => item.id === target.id ? { ...item, title: item.title === 'New conversation' ? clean.slice(0, 80) : item.title } : item))
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError(reason instanceof Error ? reason.message : 'The simulated assistant is unavailable.')
    } finally { if (abortRef.current === controller) abortRef.current = null; setBusy(false) }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!conversation) { void createConversation(draft).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not start a conversation.')) }
    else void sendMessage(draft)
  }

  return (
    <section className="assistant-page" aria-labelledby="assistant-title">
      <div className="page-intro">
        <div><div className="overline"><span className="overline-line" />ACCOUNT-AWARE ASSISTANT</div><h1 id="assistant-title">Assistant<span className="title-period">.</span></h1><p className="page-subtitle">Ask about saved records for the selected account.</p></div>
        <div className="assistant-account-status"><strong>{account?.label ?? 'Account unavailable'}</strong><span className="mode-badge"><span />{account?.mode ?? 'SIMULATED'} · {account?.environment ?? 'DEMO'}</span></div>
      </div>
      <div className="assistant-preview-banner" role="note"><Bot size={17} /><p><strong>Simulated assistant.</strong> Answers use local fixture records. Completed trade history and learning records are not connected. No provider is called and no account actions are available.</p></div>
      <div className="assistant-workspace">
        <aside className="assistant-conversations" aria-label="Conversation history">
          <div className="assistant-sidebar-heading"><h2>Conversations</h2><button type="button" className="assistant-new-button" onClick={() => { setConversation(null); setError('') }} aria-label="Start a new conversation"><Plus size={16} />New</button></div>
          <ul>{conversations.map((item) => <li key={item.id} className={conversation?.id === item.id ? 'is-selected' : ''}>
            <button type="button" className="assistant-conversation-open" onClick={() => void openConversation(item)}><MessageCircle size={15} /><span>{item.title}</span></button>
            <button type="button" className="assistant-delete-button" onClick={() => void deleteConversation(item.id)} aria-label={`Delete conversation ${item.title}`} title="Delete conversation"><Trash2 size={15} /></button>
          </li>)}</ul>
          <p className="assistant-retention">Conversations expire after 90 days and are removed on your next chat visit. Delete sooner here.</p>
        </aside>
        <div className="assistant-chat-panel">
          <div className="assistant-chat-heading"><div><span className="eyebrow">SIMULATED RECORDS</span><h2>{conversation?.title ?? 'New conversation'}</h2></div><span className="assistant-mode-label">{account?.mode ?? 'SIMULATED'} · {account?.environment ?? 'DEMO'}</span></div>
          <div className="assistant-message-list" role="log" aria-label="Conversation messages" aria-live="polite">
            {conversation?.messages?.map((message) => <article className={`assistant-message assistant-message--${message.role}`} key={message.id}>
              <span className="assistant-message-role">{message.role === 'assistant' ? 'Simulated assistant' : 'You'}</span><p>{message.content}</p>
              {!!message.citations.length && <div className="assistant-citations"><span>Records</span>{message.citations.map((citation) => /^sim-(outcome-|trader-\d+-(attempt|block))/.test(citation) && account ? <a key={citation} href={`/api/simulation/accounts/${encodeURIComponent(account.id)}/trade-history/${encodeURIComponent(citation)}`} target="_blank" rel="noreferrer" title={`Open simulated history record ${citation}`}>{citation}</a> : <code key={citation}>{citation}</code>)}</div>}
            </article>)}
            {!conversation?.messages?.length && <div className="assistant-empty"><span className="assistant-empty-icon"><Bot size={22} /></span><h3>What would you like to understand?</h3><p>Answers cite account, position, command, and decision records when available.</p><div className="assistant-starters">{starters.map((question) => <button type="button" key={question} onClick={() => conversation ? void sendMessage(question) : void createConversation(question).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not start a conversation.'))}>{question}</button>)}</div></div>}
            {busy && <p className="assistant-status" role="status">Preparing a simulated answer…</p>}
            {!!error && <p className="assistant-error" role="alert">{error}</p>}
          </div>
          <form className="assistant-composer" onSubmit={onSubmit}>
            <label className="sr-only" htmlFor="assistant-message">Ask about this account</label>
            <textarea id="assistant-message" rows={2} maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about this account’s saved records…" disabled={!account || busy} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} />
            {busy ? <button type="button" className="assistant-send-button assistant-cancel-button" onClick={() => abortRef.current?.abort()} aria-label="Cancel response"><X size={17} /><span>Cancel</span></button> : <button type="submit" className="assistant-send-button" disabled={!draft.trim() || !account} aria-label="Send message"><Send size={17} /><span>Send</span></button>}
            <small>Enter to send · Shift+Enter for a new line</small>
          </form>
        </div>
      </div>
    </section>
  )
}
