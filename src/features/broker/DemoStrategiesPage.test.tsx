// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DemoStrategiesPage } from './DemoStrategiesPage'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)
afterEach(() => { cleanup(); vi.clearAllMocks() })

it('shows a paired LIVE account as read only without DEMO strategy controls', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ accounts: [{
    id: 'live-1', broker: 'Broker', server: 'Live', login: '12345', environment: 'LIVE',
    observedAt: '2026-11-19T10:00:00.000Z', stale: true,
  }] }) })

  render(<DemoStrategiesPage />)

  expect(await screen.findByRole('heading', { name: 'Live accounts are read only' })).toBeTruthy()
  expect(screen.getByText(/LIVE · Login 12345/)).toBeTruthy()
  expect(screen.getByText(/Automatic live orders are unavailable/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Save strategy draft' })).toBeNull()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
