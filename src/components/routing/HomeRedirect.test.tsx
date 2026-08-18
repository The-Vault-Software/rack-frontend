import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HomeRedirect } from './HomeRedirect'

const useAuthMock = vi.fn()
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

/**
 * `/` is where both a fresh login and a bare visit land, so this component
 * is the only thing that decides a user's starting page. The loading case
 * matters as much as the two outcomes: reading `is_superuser` before the
 * user-info query settles yields `undefined`, which routes a legitimate
 * superuser to the dashboard — the failure only ever hits the people the
 * redirect exists for, so it is asserted explicitly rather than assumed.
 */
function renderHome() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <HomeRedirect /> },
      { path: '/dashboard', element: <p>panel de la empresa</p> },
      { path: '/admin/licenses', element: <p>administracion de licencias</p> },
    ],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('HomeRedirect', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
  })

  it('sends a superuser to the licence administration panel', async () => {
    useAuthMock.mockReturnValue({ isLoading: false, user: { is_superuser: true } })

    renderHome()

    expect(await screen.findByText('administracion de licencias')).toBeInTheDocument()
  })

  it('sends a non-superuser to the company dashboard', async () => {
    useAuthMock.mockReturnValue({ isLoading: false, user: { is_superuser: false } })

    renderHome()

    expect(await screen.findByText('panel de la empresa')).toBeInTheDocument()
  })

  it('redirects nowhere while the user is still loading', () => {
    useAuthMock.mockReturnValue({ isLoading: true, user: undefined })

    renderHome()

    expect(screen.queryByText('panel de la empresa')).not.toBeInTheDocument()
    expect(screen.queryByText('administracion de licencias')).not.toBeInTheDocument()
  })
})
