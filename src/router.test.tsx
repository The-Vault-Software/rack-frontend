import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routes } from './router'

/**
 * Requirement `onboarding-wizard` #1 (register mounts the wizard) and #10
 * (legacy signup routes redirect unconditionally into the wizard).
 *
 * `/create-company` and `/setup-branch` are rendered WITHOUT wrapping an
 * `AuthContext.Provider`. This is deliberate, not an oversight: `useAuth()`
 * throws when no provider is present (see `src/context/AuthContext.tsx`), so
 * if either route were still a child of `ProtectedLayout` this test would
 * fail with that thrown error instead of reaching `/register`. A passing
 * test therefore proves BOTH that the redirect is unconditional AND that it
 * is positioned outside the auth-gated layout — not just that it eventually
 * lands on the right URL.
 */
function renderAt(path: string) {
  const memoryRouter = createMemoryRouter(routes, { initialEntries: [path] })
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={memoryRouter} />
    </QueryClientProvider>,
  )
}

describe('router', () => {
  it('mounts the onboarding wizard at /register', async () => {
    renderAt('/register')

    expect(await screen.findByText('Paso 1 de 4')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre de la Empresa')).toBeInTheDocument()
  })

  it('redirects /create-company to /register unconditionally, outside ProtectedLayout', async () => {
    renderAt('/create-company')

    expect(await screen.findByText('Paso 1 de 4')).toBeInTheDocument()
  })

  it('redirects /setup-branch to /register unconditionally, outside ProtectedLayout', async () => {
    renderAt('/setup-branch')

    expect(await screen.findByText('Paso 1 de 4')).toBeInTheDocument()
  })
})
