type BotifyMarkProps = { compact?: boolean }

export function BotifyMark({ compact = false }: BotifyMarkProps) {
  return (
    <span className={`brand-lockup${compact ? ' brand-lockup--compact' : ''}`}>
      <svg className="brand-mark" viewBox="0 0 48 48" role="img" aria-label="Botify mark">
        <path d="M40 8A20 20 0 1 0 40 40" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="square" />
        <path d="M16 29V18m0 11h7V18h-7m7 11V14h8v15h-8m0 0v7m8-7V22m0 7h7V20h-7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" strokeLinejoin="miter" />
        <path d="M16 18v-4m0 15v5m15-20v-4m0 22v4m7-16v-4m0 15v4" stroke="currentColor" strokeWidth="2.1" />
        <path d="M20 22v5m10-7v8m-13-6h4m9 1h4" stroke="var(--red-400)" strokeWidth="2.2" />
      </svg>
      {!compact && <span className="brand-word">Boti<span>fy</span></span>}
    </span>
  )
}
