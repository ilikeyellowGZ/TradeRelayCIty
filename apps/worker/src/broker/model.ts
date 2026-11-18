export type BrokerPosition = {
  ticket: string
  symbol: string
  side: 'BUY' | 'SELL'
  volume: number
  priceOpen: number
  priceCurrent: number
  profit: number
  stop: number | null
  target: number | null
}

export type BrokerSnapshot = {
  observedAt: string
  account: {
    broker: string
    server: string
    login: string
    environment: 'DEMO' | 'LIVE'
    currency: string
    balance: number
    equity: number
    marginUsed: number | null
    marginFree: number | null
    floatingProfit: number | null
  }
  positions: BrokerPosition[]
}

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null

const boundedText = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max && value.trim() === value && !/[\x00-\x1f\x7f]/.test(value)

const boundedNumber = (value: unknown, minimum: number, maximum = 1e12): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum

const optionalPrice = (value: unknown): value is number | null => value === null || boundedNumber(value, 0.000000001)

export function normalizeSnapshot(input: unknown, now: Date): BrokerSnapshot {
  const body = record(input)
  const observedAt = body?.observedAt
  if (typeof observedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(observedAt)) throw new Error('SNAPSHOT_TIME_INVALID')
  const observedTime = Date.parse(observedAt)
  if (!Number.isFinite(observedTime) || now.getTime() - observedTime > 120_000 || observedTime - now.getTime() > 30_000) throw new Error('SNAPSHOT_TIME_INVALID')

  const account = record(body?.account)
  if (!account || !boundedText(account.broker, 80) || !boundedText(account.server, 100) || !boundedText(account.login, 40)
    || !['DEMO', 'LIVE'].includes(String(account.environment)) || typeof account.currency !== 'string' || !/^[A-Z]{3}$/.test(account.currency)
    || !boundedNumber(account.balance, 0) || !boundedNumber(account.equity, 0)
    || !boundedNumber(account.marginUsed, 0) || !boundedNumber(account.marginFree, -1e12)
    || !boundedNumber(account.floatingProfit, -1e12)) throw new Error('SNAPSHOT_ACCOUNT_INVALID')

  if (!Array.isArray(body?.positions) || body.positions.length > 100) throw new Error('SNAPSHOT_POSITIONS_INVALID')
  const tickets = new Set<string>()
  const positions: BrokerPosition[] = body.positions.map((item) => {
    const position = record(item)
    if (!position || !boundedText(position.ticket, 40) || tickets.has(position.ticket)
      || typeof position.symbol !== 'string' || !/^[A-Za-z0-9._-]{1,32}$/.test(position.symbol)
      || !['BUY', 'SELL'].includes(String(position.side)) || !boundedNumber(position.volume, 0.000000001, 1e6)
      || !boundedNumber(position.priceOpen, 0.000000001) || !boundedNumber(position.priceCurrent, 0.000000001)
      || !boundedNumber(position.profit, -1e12) || !optionalPrice(position.stop) || !optionalPrice(position.target)) throw new Error('SNAPSHOT_POSITIONS_INVALID')
    tickets.add(position.ticket)
    return {
      ticket: position.ticket,
      symbol: position.symbol,
      side: position.side as 'BUY' | 'SELL',
      volume: position.volume,
      priceOpen: position.priceOpen,
      priceCurrent: position.priceCurrent,
      profit: position.profit,
      stop: position.stop,
      target: position.target,
    }
  })
  return {
    observedAt,
    account: {
      broker: account.broker,
      server: account.server,
      login: account.login,
      environment: account.environment as 'DEMO' | 'LIVE',
      currency: account.currency,
      balance: account.balance,
      equity: account.equity,
      marginUsed: account.marginUsed,
      marginFree: account.marginFree,
      floatingProfit: account.floatingProfit,
    },
    positions,
  }
}

export async function digestSecret(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function randomPairingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  return Array.from(bytes, (byte) => alphabet[byte & 31]).join('')
}

export function randomDeviceToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
