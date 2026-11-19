// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RecoveryCodesPanel } from './RecoveryCodesPanel'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)
afterEach(() => { cleanup(); vi.clearAllMocks() })

it('requires a current password and shows replacement codes only after success', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ recoveryCodes: ['AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD'] }) })
  render(<RecoveryCodesPanel />)
  fireEvent.click(screen.getByRole('button', { name: /generate new recovery codes/i }))
  expect(fetchMock).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'long-password-123' } })
  fireEvent.click(screen.getByRole('button', { name: /generate new recovery codes/i }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/account/recovery-codes/rotate', expect.objectContaining({ method: 'POST' })))
  expect(await screen.findByText('AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD')).toBeTruthy()
  expect((screen.getByLabelText('Current password') as HTMLInputElement).value).toBe('')
})
