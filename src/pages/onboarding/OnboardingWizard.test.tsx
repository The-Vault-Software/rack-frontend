import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { client } from '../../client/client.gen'
import { buildOnboardingPayload } from './onboardingPayload'
import OnboardingWizard from './OnboardingWizard'

const COMPANY = {
  name: 'Acme Distribuciones',
  email: 'contacto@acme.com',
  rif: 'J-00123072-6',
  fiscal_state: 'Miranda',
  fiscal_city: 'Los Teques',
  fiscal_municipality: 'Guaicaipuro',
  fiscal_street: 'Av. Bermúdez',
}

const BRANCH = { name: 'Sucursal Principal' }

const OWNER = {
  email: 'owner@acme.com',
  password: 'supersecret1',
  first_name: 'Ana',
  last_name: 'Pérez',
  username: 'ana_perez',
}

const EMPLOYEE = {
  email: 'empleado@acme.com',
  password: 'supersecret1',
  first_name: 'Luis',
  last_name: 'Gómez',
  username: 'luis_gomez',
}

function renderWizard() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/register']}>
        <OnboardingWizard />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function fillCompanyStep() {
  await userEvent.type(screen.getByLabelText('Nombre de la Empresa'), COMPANY.name)
  await userEvent.type(screen.getByLabelText('Email Corporativo'), COMPANY.email)
  await userEvent.type(screen.getByLabelText('RIF'), COMPANY.rif)
  await userEvent.type(screen.getByLabelText('Estado'), COMPANY.fiscal_state)
  await userEvent.type(screen.getByLabelText('Ciudad'), COMPANY.fiscal_city)
  await userEvent.type(screen.getByLabelText('Municipio'), COMPANY.fiscal_municipality)
  await userEvent.type(screen.getByLabelText('Calle'), COMPANY.fiscal_street)
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
}

async function fillBranchesStep() {
  await userEvent.type(await screen.findByLabelText('Nombre de la Sucursal 1'), BRANCH.name)
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
}

async function fillEmployeesStep() {
  await userEvent.type(await screen.findByLabelText('Email del Propietario'), OWNER.email)
  await userEvent.type(screen.getByLabelText('Contraseña del Propietario'), OWNER.password)
  await userEvent.type(screen.getByLabelText('Nombre del Propietario'), OWNER.first_name)
  await userEvent.type(screen.getByLabelText('Apellido del Propietario'), OWNER.last_name)
  await userEvent.type(screen.getByLabelText('Usuario del Propietario'), OWNER.username)
  await userEvent.type(screen.getByLabelText('Email del Empleado 1'), EMPLOYEE.email)
  await userEvent.type(screen.getByLabelText('Contraseña del Empleado 1'), EMPLOYEE.password)
  await userEvent.type(screen.getByLabelText('Nombre del Empleado 1'), EMPLOYEE.first_name)
  await userEvent.type(screen.getByLabelText('Apellido del Empleado 1'), EMPLOYEE.last_name)
  await userEvent.type(screen.getByLabelText('Usuario del Empleado 1'), EMPLOYEE.username)
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
}

describe('OnboardingWizard', () => {
  it('renders step 1 only on a fresh visit; steps 2-4 are unreachable', () => {
    renderWizard()

    expect(screen.getByLabelText('Nombre de la Empresa')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nombre de la Sucursal 1')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Email del Propietario')).not.toBeInTheDocument()
    expect(screen.queryByText('Confirmar y Enviar')).not.toBeInTheDocument()
  })

  it('blocks forward navigation from step 1 when required fields are invalid and surfaces the error', async () => {
    renderWizard()

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(await screen.findByText('Nombre de la empresa requerido')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nombre de la Sucursal 1')).not.toBeInTheDocument()
  })

  it('preserves step 1 data when navigating backward from step 2', async () => {
    renderWizard()

    await fillCompanyStep()
    expect(await screen.findByLabelText('Nombre de la Sucursal 1')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Atrás' }))

    expect(await screen.findByDisplayValue(COMPANY.name)).toBeInTheDocument()
  })

  it('fires exactly one POST /v1/onboarding/ request on submit, with the exact built payload, and none on steps 1-3', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      void input
      return new Response(
        JSON.stringify({
          company: { id: 'c1', name: COMPANY.name },
          branches: [{ id: 'b1', name: BRANCH.name }],
          owner: { id: 'o1', email: OWNER.email },
          employees: [{ id: 'e1', email: EMPLOYEE.email }],
        }),
        { status: 201 },
      )
    })
    client.setConfig({ baseUrl: 'http://localhost', fetch: fetchMock })

    renderWizard()
    await fillCompanyStep()
    expect(fetchMock).not.toHaveBeenCalled()

    await fillBranchesStep()
    expect(fetchMock).not.toHaveBeenCalled()

    await fillEmployeesStep()
    expect(fetchMock).not.toHaveBeenCalled()

    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar y Enviar' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const request = fetchMock.mock.calls[0][0] as Request
    expect(request.method).toBe('POST')
    expect(request.url).toContain('/v1/onboarding/')

    const body = await request.clone().json()
    const expectedPayload = buildOnboardingPayload({
      company: { ...COMPANY, fiscal_postal_code: '' },
      branches: [{ ...BRANCH, address: '', phone: '', email: '' }],
      owner: OWNER,
      employees: [{ ...EMPLOYEE, branch_index: 0 }],
    })
    expect(body).toEqual(expectedPayload)
  })

  it('keeps the wizard on the offending step after a rejected submission, with all entered values still populated', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ company: { rif: 'This rif is already in use.' } }), {
          status: 400,
        }),
    )
    client.setConfig({ baseUrl: 'http://localhost', fetch: fetchMock })

    renderWizard()
    await fillCompanyStep()
    await fillBranchesStep()
    await fillEmployeesStep()
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar y Enviar' }))

    expect(await screen.findByText('This rif is already in use.')).toBeInTheDocument()
    expect(await screen.findByDisplayValue(COMPANY.name)).toBeInTheDocument()
    expect(screen.queryByText(/parcial/i)).not.toBeInTheDocument()

    // Step 2's data (branches) also survived the round trip back to step 1.
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByDisplayValue(BRANCH.name)).toBeInTheDocument()
  })

  it('never writes to localStorage or sessionStorage at any step transition; a refresh restarts at step 1', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    const { unmount } = renderWizard()
    await fillCompanyStep()
    await fillBranchesStep()
    await fillEmployeesStep()

    expect(setItemSpy).not.toHaveBeenCalled()
    setItemSpy.mockRestore()

    unmount()
    renderWizard()

    expect(screen.getByLabelText('Nombre de la Empresa')).toBeInTheDocument()
    expect(screen.queryByDisplayValue(COMPANY.name)).not.toBeInTheDocument()
  })
})
