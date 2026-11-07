type TradeRelayCityMarkProps = { compact?: boolean }

export function BotifyMark({ compact = false }: TradeRelayCityMarkProps) {
  return (
    <span className={`brand-lockup${compact ? ' brand-lockup--compact' : ''}`}>
      <svg className="brand-mark" viewBox="0 0 48 48" role="img" aria-label="TradeRelayCity candlestick mark">
        <path d="M39.6 8.4a20 20 0 1 0 0 31.2" fill="none" stroke="currentColor" strokeWidth="4.8" strokeLinecap="square" />
        <path d="M14.5 28V20m0 8h7v-8h-7m7 8V16h8v12h-8m0 0v8m8-8v-5m0 5h7v-7h-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" strokeLinejoin="miter" />
        <path d="M14.5 20v-4m0 20v-4m15.5-16v-4m0 28v-4m7-16v-4m0 20v-4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M17 22v4m10-8v9m-12-5h4m9 1h4" stroke="var(--red-400)" strokeWidth="2.2" />
      </svg>
      {!compact && <span className="brand-word">Trade<span>Relay</span>City</span>}
    </span>
  )
}
