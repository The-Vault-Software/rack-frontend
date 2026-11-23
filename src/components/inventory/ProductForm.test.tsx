import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { client } from '../../client/client.gen'
import ProductForm from './ProductForm'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function setup() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const request = input as Request
    const { pathname } = new URL(request.url)
    if (request.method === 'POST' && pathname === '/v1/product/') return json({ id: 'p1' }, 201)
    return json([])
  })
  client.setConfig({ baseUrl: 'http://localhost', fetch: fetchMock })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProductForm onSuccess={vi.fn()} />
    </QueryClientProvider>,
  )
  return fetchMock
}

async function fillRequired() {
  await userEvent.type(screen.getByLabelText('Nombre del Producto'), 'Pollo entero')
  await userEvent.type(screen.getByLabelText('Precio Costo (Base USD)'), '3.00')
  await userEvent.type(screen.getByLabelText('Precio de Venta (USD)'), '5.00')
}

async function postedBody(fetchMock: ReturnType<typeof setup>) {
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([i]) => (i as Request).method === 'POST')).toBe(true))
  const [request] = fetchMock.mock.calls.find(([i]) => (i as Request).method === 'POST')!
  return (request as Request).json()
}

describe('ProductForm perishability', () => {
  it('fills the reference days for the class and sends an override', async () => {
    const fetchMock = setup()
    await fillRequired()

    await userEvent.selectOptions(screen.getByLabelText('Caducidad'), 'FRESH')
    const days = screen.getByLabelText('Vida útil (días)') as HTMLInputElement
    expect(days.value).toBe('10')

    await userEvent.clear(days)
    await userEvent.type(days, '7')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar Producto' }))

    const body = await postedBody(fetchMock)
    expect(body.perishability).toBe('FRESH')
    expect(body.shelf_life_days).toBe(7)
  })

  it('resets the days when the class changes, instead of keeping an old override', async () => {
    setup()
    await userEvent.selectOptions(screen.getByLabelText('Caducidad'), 'FRESH')
    const days = screen.getByLabelText('Vida útil (días)') as HTMLInputElement
    await userEvent.clear(days)
    await userEvent.type(days, '7')

    await userEvent.selectOptions(screen.getByLabelText('Caducidad'), 'SHORT')

    expect((screen.getByLabelText('Vida útil (días)') as HTMLInputElement).value).toBe('30')
  })

  it('sends no days for unclassified or non-perishable products', async () => {
    const fetchMock = setup()
    await fillRequired()
    await userEvent.selectOptions(screen.getByLabelText('Caducidad'), 'NONE')

    expect(screen.queryByLabelText('Vida útil (días)')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar Producto' }))

    const body = await postedBody(fetchMock)
    expect(body.perishability).toBe('NONE')
    expect(body.shelf_life_days).toBeNull()
  })
})
