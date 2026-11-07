export type SimulationCommandStatus =
  | 'pending'
  | 'claimed'
  | 'submitting'
  | 'filled'
  | 'partially_filled'
  | 'rejected'
  | 'expired'
  | 'cancelled'
  | 'unknown'

export type SimulationUser = { id: string; name: string; role: 'owner' | 'member' }
export type SimulationAccount = {
  id: string
  ownerId: string
  label: string
  broker: string
  server: string
  login: string
  environment: 'DEMO'
  mode: 'SIMULATED'
  isLive: false
  currency: string
  balance: number
  equity: number
  dailyPnl: number
  connected: boolean
}
export type SimulationPosition = {
  id: string
  accountId: string
  symbol: string
  description: string
  side: 'BUY' | 'SELL'
  volume: number
  entry: number
  market: number
  pnl: number
  source: 'SIMULATED'
}
export type SimulationCommand = {
  id: string
  ownerId: string
  accountId: string
  status: SimulationCommandStatus
  operation: 'OPEN' | 'CLOSE' | 'HOLD'
  symbol: string
  note: string
  expiresAt: string
  attempts: number
}
export type SimulationState = {
  users: SimulationUser[]
  accounts: SimulationAccount[]
  positions: SimulationPosition[]
  commands: SimulationCommand[]
  decisions: { id: string; ownerId: string; decision: 'HOLD' | 'BUY' | 'SELL'; rationale: string }[]
  events: { id: string; ownerId: string; kind: string; message: string }[]
}

export class SimulationAccessError extends Error {
  constructor() {
    super('Resource not found')
    this.name = 'SimulationAccessError'
  }
}

const iso = (minutesFromNow: number) => new Date(Date.now() + minutesFromNow * 60_000).toISOString()

export function createSimulationState(): SimulationState {
  const users: SimulationUser[] = [
    { id: 'sim-owner', name: 'Jordan Davis', role: 'owner' },
    { id: 'sim-trader-1', name: 'Morgan Lee', role: 'member' },
    { id: 'sim-trader-2', name: 'Taylor Reed', role: 'member' },
  ]
  const accounts: SimulationAccount[] = users.map((user, index) => ({
    id: index === 0 ? 'sim-account-owner' : `sim-account-${index}`,
    ownerId: user.id,
    label: index === 0 ? 'Owner demo account' : `${user.name.split(' ')[0]}'s demo account`,
    broker: 'Simulation Broker',
    server: 'TRC-SIM-DEMO',
    login: `SIM-00${index + 1}`,
    environment: 'DEMO',
    mode: 'SIMULATED',
    isLive: false,
    currency: 'USD',
    balance: [24_580, 12_400, 18_250][index],
    equity: [24_764.32, 12_442.18, 18_198.6][index],
    dailyPnl: [184.32, 42.18, -51.4][index],
    connected: index !== 2,
  }))
  const symbols = [
    { symbol: 'EURUSD', description: 'Euro / US Dollar', side: 'BUY' as const, entry: 1.0842, market: 1.08634, pnl: 25.68, volume: 0.12 },
    { symbol: 'GBPUSD', description: 'British Pound / US Dollar', side: 'SELL' as const, entry: 1.2715, market: 1.2731, pnl: -12.8, volume: 0.08 },
    { symbol: 'XAUUSD', description: 'Gold / US Dollar', side: 'BUY' as const, entry: 2331.8, market: 2338.1, pnl: 18.9, volume: 0.03 },
  ]
  const positions: SimulationPosition[] = users.flatMap((user, ownerIndex) => symbols.slice(0, ownerIndex === 0 ? 3 : ownerIndex === 1 ? 1 : 2).map((item, i) => ({
    id: `sim-position-${ownerIndex}-${i}`,
    accountId: accounts[ownerIndex].id,
    ...item,
    source: 'SIMULATED' as const,
  })))
  const commands: SimulationCommand[] = users.flatMap((user, index) => [
    { id: `sim-command-${index}-pending`, ownerId: user.id, accountId: accounts[index].id, status: 'pending' as const, operation: 'OPEN' as const, symbol: 'EURUSD', note: 'Awaiting local risk review', expiresAt: iso(5), attempts: 0 },
    { id: `sim-command-${index}-expired`, ownerId: user.id, accountId: accounts[index].id, status: 'expired' as const, operation: 'OPEN' as const, symbol: 'GBPUSD', note: 'Expired before connector claim', expiresAt: iso(-10), attempts: 0 },
    { id: `sim-command-${index}-rejected`, ownerId: user.id, accountId: accounts[index].id, status: 'rejected' as const, operation: 'OPEN' as const, symbol: 'XAUUSD', note: 'Rejected by deterministic risk guard', expiresAt: iso(-2), attempts: 1 },
  ])
  return {
    users,
    accounts,
    positions,
    commands,
    decisions: users.map((user, index) => ({ id: `sim-decision-${index}`, ownerId: user.id, decision: 'HOLD', rationale: 'No confirmed setup; the simulation never forces an entry.' })),
    events: users.map((user, index) => ({ id: `sim-event-${index}`, ownerId: user.id, kind: index === 2 ? 'connector_disconnected' : 'snapshot_refreshed', message: index === 2 ? 'Connector offline; no new commands are submitted.' : 'Simulated account snapshot refreshed.' })),
  }
}

export function listAccountsForUser(state: SimulationState, userId: string) {
  return state.accounts.filter((account) => account.ownerId === userId)
}

export function readAccountOverview(state: SimulationState, userId: string, accountId: string) {
  const account = state.accounts.find((item) => item.id === accountId && item.ownerId === userId)
  if (!account) throw new SimulationAccessError()
  return {
    ...account,
    balance: { amount: account.balance, currency: account.currency },
    positions: state.positions.filter((item) => item.accountId === account.id),
    commands: state.commands.filter((item) => item.accountId === account.id),
    latestDecision: state.decisions.find((item) => item.ownerId === userId),
    events: state.events.filter((item) => item.ownerId === userId),
  }
}

const transitions: Record<SimulationCommandStatus, SimulationCommandStatus[]> = {
  pending: ['claimed', 'expired', 'cancelled'],
  claimed: ['submitting', 'expired', 'cancelled', 'unknown'],
  submitting: ['filled', 'partially_filled', 'rejected', 'unknown'],
  filled: [], partially_filled: ['filled', 'unknown'], rejected: [], expired: [], cancelled: [], unknown: ['filled', 'partially_filled', 'rejected', 'cancelled'],
}

export function transitionCommand(state: SimulationState, actorId: string, commandId: string, target: SimulationCommandStatus) {
  const current = state.commands.find((item) => item.id === commandId)
  if (!current || current.ownerId !== actorId) throw new SimulationAccessError()
  if (current.status === target) return { state, command: current }
  if (!transitions[current.status].includes(target)) throw new Error(`Invalid command transition: ${current.status} -> ${target}`)
  const command = { ...current, status: target, attempts: current.attempts + (target === 'submitting' ? 1 : 0) }
  return { state: { ...state, commands: state.commands.map((item) => item.id === commandId ? command : item) }, command }
}
