import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReviewStep } from './ReviewStep'

const COMPANY = {
  name: 'Acme Distribuciones',
  email: 'contacto@acme.com',
  rif: 'J-00123072-6',
  fiscal_state: 'Miranda',
  fiscal_city: 'Los Teques',
  fiscal_municipality: 'Guaicaipuro',
  fiscal_street: 'Av. Bermúdez',
  fiscal_postal_code: '1201',
}

const BRANCHES = [
  { name: 'Sucursal Principal', address: 'Calle 1', phone: '0212-1111111', email: 'principal@acme.com' },
  { name: 'Sucursal Norte', address: 'Calle 2', phone: '0212-2222222', email: 'norte@acme.com' },
]

const OWNER = {
  email: 'owner@acme.com',
  password: 'supersecret1',
  first_name: 'Ana',
  last_name: 'Pérez',
  username: 'ana_perez',
}

const EMPLOYEES = [
  {
    email: 'empleado1@acme.com',
    password: 'supersecret1',
    first_name: 'Luis',
    last_name: 'Gómez',
    username: 'luis_gomez',
    branch_index: 0,
  },
  {
    email: 'empleado2@acme.com',
    password: 'supersecret1',
    first_name: 'Carla',
    last_name: 'Ruiz',
    username: 'carla_ruiz',
    branch_index: 1,
  },
]

describe('ReviewStep', () => {
  it('renders every required field entered in steps 1-3 with no silent transformation or drop', () => {
    render(
      <ReviewStep
        company={COMPANY}
        branches={BRANCHES}
        owner={OWNER}
        employees={EMPLOYEES}
        onSubmit={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    // Company
    expect(screen.getByText(COMPANY.name)).toBeInTheDocument()
    expect(screen.getByText(COMPANY.email)).toBeInTheDocument()
    expect(screen.getByText(COMPANY.rif)).toBeInTheDocument()
    expect(screen.getByText(COMPANY.fiscal_state)).toBeInTheDocument()
    expect(screen.getByText(COMPANY.fiscal_city)).toBeInTheDocument()
    expect(screen.getByText(COMPANY.fiscal_municipality)).toBeInTheDocument()
    expect(screen.getByText(COMPANY.fiscal_street)).toBeInTheDocument()

    // Branches
    expect(screen.getByText(BRANCHES[0].name)).toBeInTheDocument()
    expect(screen.getByText(BRANCHES[1].name)).toBeInTheDocument()

    // Owner
    expect(screen.getByText(OWNER.email)).toBeInTheDocument()
    expect(screen.getByText(OWNER.username)).toBeInTheDocument()

    // Employees
    expect(screen.getByText(EMPLOYEES[0].email)).toBeInTheDocument()
    expect(screen.getByText(EMPLOYEES[1].email)).toBeInTheDocument()
    expect(screen.getByText('Sucursal 1 - Sucursal Principal')).toBeInTheDocument()
    expect(screen.getByText('Sucursal 2 - Sucursal Norte')).toBeInTheDocument()
  })
})
