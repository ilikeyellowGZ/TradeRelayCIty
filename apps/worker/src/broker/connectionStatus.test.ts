import { describe, expect, it } from 'vitest'
import { getConnectionStatus, type ConnectorDevice } from '../../../../src/features/broker/connectionStatus'

const now = 1_800_000_000_000
const device = (lastState: ConnectorDevice['lastState'], lastSeenAt: number | null, revokedAt: number | null = null): ConnectorDevice => ({ lastState, lastSeenAt, revokedAt })

describe('MT5 connector status', () => {
  it('never treats a paired or old snapshot as a live connection', () => {
    expect(getConnectionStatus([device('PAIRED', null)], now).label).toBe('MT5 paired, awaiting sync')
    expect(getConnectionStatus([device('SYNCED', now - 46_000)], now).label).toBe('MT5 status unverified')
  })

  it('shows a recent sync and gives it priority over another offline device', () => {
    expect(getConnectionStatus([device('MCP_OFFLINE', now), device('SYNCED', now - 12_000)], now).label).toBe('MT5 MCP connected')
  })

  it('shows reported failures and ignores revoked devices', () => {
    expect(getConnectionStatus([device('MCP_ERROR', now)], now).label).toBe('MT5 read error')
    expect(getConnectionStatus([device('SYNCED', now, now)], now).label).toBe('MT5 not paired')
  })
})
