import { describe, expect, it } from 'vitest'
import {
  SimulationAccessError,
  createSimulationState,
  listAccountsForUser,
  readAccountOverview,
  transitionCommand,
} from './core'

describe('local simulation tenant boundaries', () => {
  it('seeds three independent personas and one isolated simulated account each', () => {
    const state = createSimulationState()

    expect(state.users).toHaveLength(3)
    for (const user of state.users) {
      expect(listAccountsForUser(state, user.id)).toHaveLength(1)
      expect(listAccountsForUser(state, user.id)[0].ownerId).toBe(user.id)
    }
  })

  it('does not disclose another persona’s account overview', () => {
    const state = createSimulationState()
    const account = state.accounts.find((item) => item.ownerId === 'sim-trader-2')!

    expect(() => readAccountOverview(state, 'sim-trader-1', account.id)).toThrow(SimulationAccessError)
    expect(() => readAccountOverview(state, 'sim-trader-1', 'missing-account')).toThrow(SimulationAccessError)
  })

  it('labels every seed and balance as simulated', () => {
    const state = createSimulationState()
    const overview = readAccountOverview(state, 'sim-trader-1', 'sim-account-1')

    expect(overview.mode).toBe('SIMULATED')
    expect(overview.isLive).toBe(false)
    expect(overview.balance.currency).toBe('USD')
    expect(overview.positions.every((position) => position.source === 'SIMULATED')).toBe(true)
  })

  it('uses forex positions and a blocked crypto attempt in the market-scope fixtures', () => {
    const state = createSimulationState()

    expect(new Set(state.positions.map((position) => position.symbol))).toEqual(new Set(['EURUSD', 'GBPUSD', 'AUDUSD']))
    expect(state.commands.filter((command) => command.status === 'rejected').every((command) => command.symbol === 'BTCUSD')).toBe(true)
  })
})

describe('simulation command journal', () => {
  it('returns the same command on duplicate delivery without duplicating its result', () => {
    const state = createSimulationState()
    const command = state.commands.find((item) => item.ownerId === 'sim-trader-1' && item.status === 'pending')!
    const claimed = transitionCommand(state, 'sim-trader-1', command.id, 'claimed')
    const repeated = transitionCommand(claimed.state, 'sim-trader-1', command.id, 'claimed')

    expect(repeated.command.id).toBe(command.id)
    expect(repeated.state.commands.filter((item) => item.id === command.id)).toHaveLength(1)
  })

  it('keeps expired, rejected and unknown commands from being submitted', () => {
    const state = createSimulationState()
    const blocked = state.commands.find((item) => item.ownerId === 'sim-trader-1' && item.status === 'expired')!

    expect(() => transitionCommand(state, 'sim-trader-1', blocked.id, 'submitting')).toThrow(/invalid command transition/i)
  })

  it('does not let one persona claim another persona’s command', () => {
    const state = createSimulationState()
    const command = state.commands.find((item) => item.ownerId === 'sim-trader-2' && item.status === 'pending')!

    expect(() => transitionCommand(state, 'sim-trader-1', command.id, 'claimed')).toThrow(SimulationAccessError)
  })
})
