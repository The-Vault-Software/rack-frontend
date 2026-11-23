import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { client } from '../../client/client.gen'
import { AuthContext } from '../../context/AuthContext'
import { BranchContext } from '../../context/BranchContext'
import UsersSettings from './UsersSettings'

const branches = [{ id: 'b1', name: 'Centro' }, { id: 'b2', name: 'Norte' }]
const users = [
  { id: 1, email: 'owner@x.com', username: 'owner', first_name: 'Ana', last_name: 'Dueña', role: 'OWNER', is_active: true, branch_ids: ['b1', 'b2'] },
  { id: 2, email: 'luis@x.com', username: 'luis', first_name: 'Luis', last_name: 'Gómez', role: 'EMPLOYEE', is_active: true, branch_ids: ['b1'] },
]

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function setup(role = 'OWNER') {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const request = input as Request
    const { pathname } = new URL(request.url)
    if (request.method === 'GET' && pathname === '/v1/company-users/') return json(users)
    if (request.method === 'PATCH' && pathname === '/v1/company-users/2/') return json({ ...users[1], is_active: false })
    if (request.method === 'POST' && pathname === '/v1/register/') return json({ email: 'nuevo@x.com' }, 201)
    return json({}, 404)
  })
  client.setConfig({ baseUrl: 'http://localhost', fetch: fetchMock })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthContext.Provider value={{ user: { email: 'owner@x.com', role } as never, isLoading: false, isAuthenticated: true, logout: vi.fn() }}>
        <BranchContext.Provider value={{ selectedBranch: branches[0] as never, setSelectedBranch: vi.fn(), branches: branches as never, isLoading: false }}>
          <UsersSettings />
        </BranchContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
  return fetchMock
}

const calls = (fetchMock: ReturnType<typeof setup>, method: string) =>
  fetchMock.mock.calls.map(([i]) => i as Request).filter((r) => r.method === method)

describe('UsersSettings', () => {
  it('lists company users with role, branches and status; owners cannot be toggled', async () => {
    setup()
    const row = (await screen.findByText('luis@x.com')).closest('tr')!
    expect(within(row).getByText('Empleado')).toBeInTheDocument()
    expect(within(row).getByText('Centro')).toBeInTheDocument()
    expect(within(row).getByText('Activo')).toBeInTheDocument()

    const ownerRow = screen.getByText('owner@x.com').closest('tr')!
    expect(within(ownerRow).getByText(/\(tú\)/)).toBeInTheDocument()
    expect(within(ownerRow).queryByRole('button')).toBeNull()
  })

  it('deactivates a user only after confirming', async () => {
    const fetchMock = setup()
    const row = (await screen.findByText('luis@x.com')).closest('tr')!
    await userEvent.click(within(row).getByRole('button', { name: 'Desactivar' }))
    expect(calls(fetchMock, 'PATCH')).toHaveLength(0)

    await userEvent.click(screen.getByRole('button', { name: 'Sí, desactivar' }))
    await waitFor(() => expect(calls(fetchMock, 'PATCH')).toHaveLength(1))
    expect(await calls(fetchMock, 'PATCH')[0].json()).toEqual({ is_active: false })
  })

  it('creates an employee with every branch preselected', async () => {
    const fetchMock = setup()
    await userEvent.click(await screen.findByRole('button', { name: /Nuevo usuario/ }))
    await userEvent.type(screen.getByLabelText('Nombre'), 'Soporte')
    await userEvent.type(screen.getByLabelText('Apellido'), 'Rack')
    await userEvent.type(screen.getByLabelText('Nombre de usuario'), 'soporte_rack')
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'soporte@x.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave-segura-123')
    await userEvent.click(screen.getByRole('button', { name: 'Crear usuario' }))

    await waitFor(() => expect(calls(fetchMock, 'POST')).toHaveLength(1))
    expect(await calls(fetchMock, 'POST')[0].json()).toEqual({
      first_name: 'Soporte', last_name: 'Rack', username: 'soporte_rack',
      email: 'soporte@x.com', password: 'clave-segura-123', branch_ids: ['b1', 'b2'],
    })
  })

  it('validates the form before sending', async () => {
    const fetchMock = setup()
    await userEvent.click(await screen.findByRole('button', { name: /Nuevo usuario/ }))
    await userEvent.type(screen.getByLabelText('Contraseña'), 'corta')
    await userEvent.click(screen.getByRole('button', { name: 'Crear usuario' }))
    expect(await screen.findByText('Mínimo 8 caracteres')).toBeInTheDocument()
    expect(calls(fetchMock, 'POST')).toHaveLength(0)
  })

  it('does not offer user management to employees', async () => {
    const fetchMock = setup('EMPLOYEE')
    expect(screen.getByText(/Solo el propietario/)).toBeInTheDocument()
    // Give a would-be request time to go out before asserting none did.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
