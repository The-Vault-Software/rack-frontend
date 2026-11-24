import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { client } from '../../../client/client.gen'
import { BranchContext } from '../../../context/BranchContext'
import MobileSaleBuilder from './MobileSaleBuilder'

const branch = { id: 'b1', name: 'Barinitas' }
const product = {
  id: 'p1', name: 'Harina P.A.N.', sku: null, description: null, cost_price_usd: '1.10',
  selling_price_usd: '1.37', IVA: false, category: null, measurement_unit: null,
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function setup() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const request = input as Request
    const { pathname } = new URL(request.url)
    if (request.method === 'POST' && pathname === '/v1/sales/') {
      return json({ id: 's1', seq_number: 7, total_amount_usd: '1.37', total_paid: '0', sale_details: [] }, 201)
    }
    if (pathname === '/v1/product/') return json([product])
    if (pathname === '/v1/product/p1/') return json({ ...product, selling_units: [] })
    if (pathname === '/v1/product-branch-stock/') return json([{ product_id: 'p1', stock: '10' }])
    if (pathname === '/v1/customers/') return json([{ id: 'c1', name: 'Emilio Peña' }])
    if (pathname === '/v1/exchange-rates/today/') return json({ bcv_rate: '100', parallel_rate: '120' })
    return json([])
  })
  client.setConfig({ baseUrl: 'http://localhost', fetch: fetchMock })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BranchContext.Provider value={{ selectedBranch: branch as never, setSelectedBranch: vi.fn(), branches: [branch as never], isLoading: false }}>
        <MobileSaleBuilder />
      </BranchContext.Provider>
    </QueryClientProvider>,
  )
  return fetchMock
}

const saleCreates = (fetchMock: ReturnType<typeof setup>) =>
  fetchMock.mock.calls.map(([i]) => i as Request).filter((r) => r.method === 'POST' && new URL(r.url).pathname === '/v1/sales/')

async function addProductAndOpenCart() {
  const card = (await screen.findByText('Harina P.A.N.')).closest('div.p-4, div[class*="rounded"]')!.parentElement!
  await waitFor(() => expect(within(card).getAllByRole('button').some((b) => !(b as HTMLButtonElement).disabled)).toBe(true))
  const addButton = within(card).getAllByRole('button').find((b) => !(b as HTMLButtonElement).disabled)!
  await userEvent.click(addButton)
  await userEvent.click(await screen.findByText('Ver Carrito'))
}

describe('MobileSaleBuilder checkout without a customer', () => {
  it('asks before creating a sale with no customer, and creates nothing until confirmed', async () => {
    const fetchMock = setup()
    await addProductAndOpenCart()

    await userEvent.click(screen.getByRole('button', { name: /Finalizar y Cobrar/ }))

    expect(await screen.findByText('¿Vender sin cliente?')).toBeInTheDocument()
    expect(saleCreates(fetchMock)).toHaveLength(0)

    await userEvent.click(screen.getByRole('button', { name: 'Continuar sin cliente' }))
    await waitFor(() => expect(saleCreates(fetchMock)).toHaveLength(1))
    expect((await saleCreates(fetchMock)[0].json()).customer).toBeNull()
  })

  it('"Seleccionar cliente" goes back to the customer picker without creating the sale', async () => {
    const fetchMock = setup()
    await addProductAndOpenCart()

    await userEvent.click(screen.getByRole('button', { name: /Finalizar y Cobrar/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Seleccionar cliente' }))

    expect(await screen.findByText('Elige el cliente de esta venta.')).toBeInTheDocument()
    expect(saleCreates(fetchMock)).toHaveLength(0)

    await userEvent.selectOptions(screen.getByLabelText('Cliente'), 'c1')
    expect(screen.queryByText('Elige el cliente de esta venta.')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Finalizar y Cobrar/ }))

    await waitFor(() => expect(saleCreates(fetchMock)).toHaveLength(1))
    expect((await saleCreates(fetchMock)[0].json()).customer).toBe('c1')
  })

  it('does not ask when a customer is selected', async () => {
    setup()
    await addProductAndOpenCart()
    await userEvent.selectOptions(screen.getByLabelText('Cliente'), 'c1')
    await userEvent.click(screen.getByRole('button', { name: /Finalizar y Cobrar/ }))
    await waitFor(() => expect(screen.queryByText('¿Vender sin cliente?')).toBeNull())
  })
})
