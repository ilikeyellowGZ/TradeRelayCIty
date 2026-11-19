// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SignUpPage } from './SignUpPage'
import { ResetPasswordPage } from './ResetPasswordPage'

const signUp = vi.fn()
const requestPasswordReset = vi.fn()
vi.mock('../auth-client', () => ({ authClient: {
  signUp: { email: (...args: unknown[]) => signUp(...args) },
  requestPasswordReset: (...args: unknown[]) => requestPasswordReset(...args),
} }))

afterEach(() => { cleanup(); vi.clearAllMocks() })

it('requires a strong password before requesting signup', () => {
  render(<SignUpPage />)
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Morgan Example' } })
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'morgan' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'morgan@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } })
  fireEvent.click(screen.getByRole('button', { name: /create account/i }))
  expect(screen.getByRole('alert').textContent).toMatch(/12 characters/)
  expect(signUp).not.toHaveBeenCalled()
})

it('creates an account and directs the user to email verification', async () => {
  signUp.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  render(<SignUpPage />)
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Morgan Example' } })
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'morgan' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'MORGAN@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-password-123' } })
  fireEvent.click(screen.getByRole('button', { name: /create account/i }))
  await waitFor(() => expect(signUp).toHaveBeenCalledWith(expect.objectContaining({ username: 'morgan', email: 'morgan@example.com', callbackURL: '/verify-email?verified=1' })))
  expect(await screen.findByRole('status')).toHaveProperty('textContent', expect.stringContaining('Check your email'))
})

it('does not disclose whether a recovery email belongs to an account', async () => {
  requestPasswordReset.mockResolvedValue({ error: { message: 'Not found' } })
  render(<ResetPasswordPage />)
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'someone@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))
  expect((await screen.findByRole('status')).textContent).toMatch(/If an account exists/)
})
