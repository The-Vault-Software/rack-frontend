import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BranchesStep } from './BranchesStep'

describe('BranchesStep', () => {
  it('blocks advancement with an "at least one branch required" error once every branch is removed', async () => {
    const onNext = vi.fn()
    render(<BranchesStep onNext={onNext} />)

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar sucursal 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(await screen.findByText('Se requiere al menos una sucursal')).toBeInTheDocument()
    expect(onNext).not.toHaveBeenCalled()
  })

  it('disables the "add branch" control once 2 branches are present', async () => {
    render(<BranchesStep onNext={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Agregar Sucursal' })).toBeEnabled()

    await userEvent.click(screen.getByRole('button', { name: 'Agregar Sucursal' }))

    expect(screen.getByLabelText('Nombre de la Sucursal 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar Sucursal' })).toBeDisabled()
  })

  it('advances with exactly 1 valid branch and the second omitted', async () => {
    const onNext = vi.fn()
    render(<BranchesStep onNext={onNext} />)

    await userEvent.type(screen.getByLabelText('Nombre de la Sucursal 1'), 'Sucursal Centro')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1))
    expect(onNext.mock.calls[0][0].branches).toHaveLength(1)
    expect(onNext.mock.calls[0][0].branches[0].name).toBe('Sucursal Centro')
  })

  it('advances with 2 valid branches filled', async () => {
    const onNext = vi.fn()
    render(<BranchesStep onNext={onNext} />)

    await userEvent.type(screen.getByLabelText('Nombre de la Sucursal 1'), 'Sucursal Centro')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar Sucursal' }))
    await userEvent.type(screen.getByLabelText('Nombre de la Sucursal 2'), 'Sucursal Este')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1))
    expect(onNext.mock.calls[0][0].branches).toHaveLength(2)
    expect(onNext.mock.calls[0][0].branches.map((b: { name: string }) => b.name)).toEqual([
      'Sucursal Centro',
      'Sucursal Este',
    ])
  })
})
