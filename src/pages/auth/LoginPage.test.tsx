import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import LoginPage from './LoginPage'
import { AuthContext } from '../../context/AuthContext'
import { enterLicenseInactive, resetLicenseGate, setLicenseRedirector } from '../../lib/licenseGate'

// onError cannot see the HTTP status — throwOnError discards it and throws
// the parsed body. Discrimination already happened upstream in the
// interceptor (see apiInterceptors.test.ts); LoginPage only reads the latch.
vi.mock('../../client/@tanstack/react-query.gen', () => ({
  v1LoginCreateMutation: () => ({
    mutationFn: () => Promise.reject({ detail: 'rejected' }),
  }),
  v1UserInfoRetrieveOptions: () => ({ queryKey: ['user-info'] }),
}))

const CREDENTIALS_ERROR = 'Credenciales inválidas o error en el servidor.'

function renderLoginPage() {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{ user: undefined, isLoading: false, isAuthenticated: false, logout: vi.fn() }}
      >
        <MemoryRouter initialEntries={['/login']}>
          <Toaster />
          <LoginPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

async function submitLogin() {
  await userEvent.type(screen.getByLabelText('Email'), 'user@example.com')
  await userEvent.type(screen.getByLabelText('Contraseña'), 'password123')
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('LoginPage', () => {
  beforeEach(() => {
    resetLicenseGate()
    setLicenseRedirector(() => {})
  })

  it('does not show the credentials error when the login rejection is a latched licence-inactive state', async () => {
    enterLicenseInactive(new QueryClient())

    renderLoginPage()
    await submitLogin()

    await waitFor(() => {
      expect(screen.queryByText(CREDENTIALS_ERROR)).not.toBeInTheDocument()
    })
  })

  it('still shows the credentials error on a rejection with the latch unset (401 regression)', async () => {
    renderLoginPage()
    await submitLogin()

    expect(await screen.findByText(CREDENTIALS_ERROR)).toBeInTheDocument()
  })
})
