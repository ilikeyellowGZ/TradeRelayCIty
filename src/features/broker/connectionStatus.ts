export type ConnectorDevice = {
  revokedAt: number | null
  lastSeenAt: number | null
  lastState: 'PAIRED' | 'SYNCED' | 'MCP_OFFLINE' | 'MCP_ERROR' | 'PAUSED'
}

export type ConnectionStatus = {
  tone: 'positive' | 'warning' | 'negative' | 'muted'
  label: string
  detail: string
}

const FRESH_FOR_MS = 45_000

export function getConnectionStatus(devices: ConnectorDevice[], now = Date.now()): ConnectionStatus {
  const active = devices.filter((device) => device.revokedAt === null)
  if (active.length === 0) return { tone: 'muted', label: 'MT5 not paired', detail: 'Pair a Windows connector in Accounts.' }
  const recentlySynced = active.find((device) => device.lastState === 'SYNCED' && device.lastSeenAt !== null && now - device.lastSeenAt < FRESH_FOR_MS)
  if (recentlySynced) return { tone: 'positive', label: 'MT5 MCP connected', detail: 'A read-only snapshot synced recently.' }
  const latest = [...active].sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0))[0]
  if (latest.lastState === 'MCP_ERROR') return { tone: 'negative', label: 'MT5 read error', detail: 'The last connector read failed. Check Accounts.' }
  if (latest.lastState === 'MCP_OFFLINE') return { tone: 'negative', label: 'MT5 MCP offline', detail: 'The connector reported an offline MCP connection.' }
  if (latest.lastState === 'PAUSED') return { tone: 'warning', label: 'MT5 sync paused', detail: 'Automatic sync is paused in the Windows connector.' }
  if (latest.lastState === 'PAIRED') return { tone: 'warning', label: 'MT5 paired, awaiting sync', detail: 'Run the first read-only MT5 sync.' }
  return { tone: 'warning', label: 'MT5 status unverified', detail: 'The last sync is too old to confirm a current connection.' }
}
