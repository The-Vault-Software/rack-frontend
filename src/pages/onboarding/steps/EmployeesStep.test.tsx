import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmployeesStep, buildEmployeesStepSchema } from './EmployeesStep'

const ONE_BRANCH = [{ name: 'Sucursal Principal' }]
const TWO_BRANCHES = [{ name: 'Sucursal Principal' }, { name: 'Sucursal Norte' }]

const VALID_OWNER = {
  email: 'owner@acme.com',
  password: 'supersecret1',
  first_name: 'Ana',
  last_name: 'Pérez',
  username: 'ana_perez',
}

const VALID_EMPLOYEE = {
  email: 'empleado@acme.com',
  password: 'supersecret1',
  first_name: 'Luis',
  last_name: 'Gómez',
  username: 'luis_gomez',
}

async function fillOwner() {
  await userEvent.type(screen.getByLabelText('Email del Propietario'), VALID_OWNER.email)
  await userEvent.type(screen.getByLabelText('Contraseña del Propietario'), VALID_OWNER.password)
  await userEvent.type(screen.getByLabelText('Nombre del Propietario'), VALID_OWNER.first_name)
  await userEvent.type(screen.getByLabelText('Apellido del Propietario'), VALID_OWNER.last_name)
  await userEvent.type(screen.getByLabelText('Usuario del Propietario'), VALID_OWNER.username)
}

describe('buildEmployeesStepSchema — branch index bound (pure logic)', () => {
  it('rejects an employee whose branch_index is outside [0, branchCount)', () => {
    const schema = buildEmployeesStepSchema(1)
    const result = schema.safeParse({
      owner: VALID_OWNER,
      employees: [{ ...VALID_EMPLOYEE, branch_index: 1 }],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((entry) => entry.path.join('.') === 'employees.0.branch_index')
      expect(issue?.message).toBe('Sucursal inválida')
    }
  })

  it('accepts an employee whose branch_index is within range (triangulation)', () => {
    const schema = buildEmployeesStepSchema(2)
    const result = schema.safeParse({
      owner: VALID_OWNER,
      employees: [{ ...VALID_EMPLOYEE, branch_index: 1 }],
    })

    expect(result.success).toBe(true)
  })
})

describe('EmployeesStep', () => {
  it('blocks advancement with zero employees', async () => {
    const onNext = vi.fn()
    render(<EmployeesStep branches={ONE_BRANCH} onNext={onNext} />)

    await fillOwner()
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar empleado 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(await screen.findByText('Se requiere al menos un empleado')).toBeInTheDocument()
    expect(onNext).not.toHaveBeenCalled()
  })

  it('blocks advancement when owner fields are empty', async () => {
    const onNext = vi.fn()
    render(<EmployeesStep branches={ONE_BRANCH} onNext={onNext} />)

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(await screen.findByText('Email del propietario requerido')).toBeInTheDocument()
    expect(onNext).not.toHaveBeenCalled()
  })

  it('advances with employees correctly bound to indices 0 and 1 across two branches', async () => {
    const onNext = vi.fn()
    render(<EmployeesStep branches={TWO_BRANCHES} onNext={onNext} />)

    await fillOwner()
    await userEvent.type(screen.getByLabelText('Email del Empleado 1'), VALID_EMPLOYEE.email)
    await userEvent.type(screen.getByLabelText('Contraseña del Empleado 1'), VALID_EMPLOYEE.password)
    await userEvent.type(screen.getByLabelText('Nombre del Empleado 1'), VALID_EMPLOYEE.first_name)
    await userEvent.type(screen.getByLabelText('Apellido del Empleado 1'), VALID_EMPLOYEE.last_name)
    await userEvent.type(screen.getByLabelText('Usuario del Empleado 1'), VALID_EMPLOYEE.username)
    await userEvent.selectOptions(screen.getByLabelText('Sucursal del Empleado 1'), '1')

    await userEvent.click(screen.getByRole('button', { name: 'Agregar Empleado' }))
    await userEvent.type(screen.getByLabelText('Email del Empleado 2'), 'segundo@acme.com')
    await userEvent.type(screen.getByLabelText('Contraseña del Empleado 2'), 'supersecret1')
    await userEvent.type(screen.getByLabelText('Nombre del Empleado 2'), 'Carla')
    await userEvent.type(screen.getByLabelText('Apellido del Empleado 2'), 'Ruiz')
    await userEvent.type(screen.getByLabelText('Usuario del Empleado 2'), 'carla_ruiz')
    await userEvent.selectOptions(screen.getByLabelText('Sucursal del Empleado 2'), '0')

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(onNext).toHaveBeenCalledTimes(1)
    const values = onNext.mock.calls[0][0]
    expect(values.employees).toHaveLength(2)
    expect(values.employees[0].branch_index).toBe(1)
    expect(values.employees[1].branch_index).toBe(0)
  })
})
