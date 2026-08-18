import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CompanyStep } from './CompanyStep'

// Fixtures per design D-F / tasks.md 2.1 — do not invent new RIFs.
const VALID_RIF = 'J-00123072-6'
const VALID_RIF_REMAINDER_10_BRANCH = 'J-00002961-0'

async function fillRequiredFields(overrides: Partial<Record<string, string>> = {}) {
  const values = {
    name: 'Panadería Central',
    email: 'contacto@panaderia.com',
    rif: VALID_RIF,
    fiscal_state: 'Miranda',
    fiscal_city: 'Los Teques',
    fiscal_municipality: 'Guaicaipuro',
    fiscal_street: 'Av. Bermúdez',
    ...overrides,
  }

  await userEvent.type(screen.getByLabelText('Nombre de la Empresa'), values.name)
  await userEvent.type(screen.getByLabelText('Email Corporativo'), values.email)
  await userEvent.type(screen.getByLabelText('RIF'), values.rif)
  await userEvent.type(screen.getByLabelText('Estado'), values.fiscal_state)
  await userEvent.type(screen.getByLabelText('Ciudad'), values.fiscal_city)
  await userEvent.type(screen.getByLabelText('Municipio'), values.fiscal_municipality)
  await userEvent.type(screen.getByLabelText('Calle'), values.fiscal_street)
}

describe('CompanyStep', () => {
  it('blocks advancement and shows field errors when all required fields are empty', async () => {
    const onNext = vi.fn()
    render(<CompanyStep onNext={onNext} />)

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(onNext).not.toHaveBeenCalled()
    expect(await screen.findByText('Nombre de la empresa requerido')).toBeInTheDocument()
    expect(screen.getByText('Email corporativo requerido')).toBeInTheDocument()
    expect(screen.getByText('RIF requerido')).toBeInTheDocument()
    expect(screen.getByText('Estado requerido')).toBeInTheDocument()
    expect(screen.getByText('Ciudad requerida')).toBeInTheDocument()
    expect(screen.getByText('Municipio requerido')).toBeInTheDocument()
    expect(screen.getByText('Calle requerida')).toBeInTheDocument()
  })

  it('advances when every required field is valid and código postal is left empty', async () => {
    const onNext = vi.fn()
    render(<CompanyStep onNext={onNext} />)

    await fillRequiredFields()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1))
    expect(onNext.mock.calls[0][0]).toEqual({
      name: 'Panadería Central',
      email: 'contacto@panaderia.com',
      rif: VALID_RIF,
      fiscal_state: 'Miranda',
      fiscal_city: 'Los Teques',
      fiscal_municipality: 'Guaicaipuro',
      fiscal_street: 'Av. Bermúdez',
      fiscal_postal_code: '',
    })
  })

  it('accepts the second RIF fixture exercising the remainder-10 check-digit branch', async () => {
    const onNext = vi.fn()
    render(<CompanyStep onNext={onNext} />)

    await fillRequiredFields({ rif: VALID_RIF_REMAINDER_10_BRANCH })
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1))
    expect(onNext.mock.calls[0][0].rif).toBe(VALID_RIF_REMAINDER_10_BRANCH)
  })

  it('blocks advancement on a RIF with a wrong check digit', async () => {
    const onNext = vi.fn()
    render(<CompanyStep onNext={onNext} />)

    await fillRequiredFields({ rif: 'J-00123072-7' })
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(await screen.findByText('RIF inválido')).toBeInTheDocument()
    expect(onNext).not.toHaveBeenCalled()
  })

  it('blocks advancement on a C- prefixed RIF regardless of check digit', async () => {
    const onNext = vi.fn()
    render(<CompanyStep onNext={onNext} />)

    await fillRequiredFields({ rif: 'C-00123072-6' })
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(await screen.findByText('RIF inválido')).toBeInTheDocument()
    expect(onNext).not.toHaveBeenCalled()
  })
})
