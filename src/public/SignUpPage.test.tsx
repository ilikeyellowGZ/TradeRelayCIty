// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SignUpPage } from './SignUpPage'
import { ResetPasswordPage } from './ResetPasswordPage'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)
afterEach(() => { cleanup(); vi.clearAllMocks() })

it('requires a strong password before requesting signup', () => {
  render(<SignUpPage />)
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Morgan Example' } })
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'morgan' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } })
  fireEvent.click(screen.getByRole('button', { name: /create account/i }))
  expect(screen.getByRole('alert').textContent).toMatch(/12 characters/)
  expect(fetchMock).not.toHaveBeenCalled()
  expect(screen.queryByLabelText('Email')).toBeNull()
})

it('shows recovery codes once and requires an acknowledgement before sign in', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ recoveryCodes: ['AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD'] }) })
  render(<SignUpPage />)
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Morgan Example' } })
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'morgan' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-password-123' } })
  fireEvent.click(screen.getByRole('button', { name: /create account/i }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/account/register', expect.objectContaining({ method: 'POST' })))
  expect(await screen.findByText('AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD')).toBeTruthy()
  expect(screen.queryByRole('link', { name: /continue to sign in/i })).toBeNull()
  fireEvent.click(screen.getByLabelText(/I have saved these codes/i))
  expect(screen.getByRole('link', { name: /continue to sign in/i })).toBeTruthy()
})

it('submits a recovery code and new password', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
  render(<ResetPasswordPage />)
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'morgan' } })
  fireEvent.change(screen.getByLabelText('Recovery code'), { target: { value: 'AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD' } })
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-long-password' } })
  fireEvent.click(screen.getByRole('button', { name: /reset password/i }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/account/recover', expect.objectContaining({ method: 'POST' })))
  expect((await screen.findByRole('status')).textContent).toMatch(/Password changed/)
})
