import { BotifyMark } from '../components/BotifyMark'

export function PublicBrand({ href = '/' }: { href?: string }) {
  return <a className="public-brand" href={href} aria-label="TradeRelayCity home"><BotifyMark compact /><span>TradeRelayCity</span></a>
}
