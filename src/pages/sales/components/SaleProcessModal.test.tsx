import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { client } from '../../../client/client.gen'
import SaleProcessModal from './SaleProcessModal'

const SALE = {
  id: '01JSALE0000000000000000000',
  branch: 'branch-1',
  branch_name: 'Principal',
  customer: null,
  customer_name: 'Walk-in Customer',
  total_amount_usd: '10.00',
  payment_status: 'PENDING',
  seq_number: 42,
  sale_details: [],
  total_paid: '0',
  created_at: '2026-11-23T00:00:00Z',
  updated_at: '2026-11-23T00:00:00Z',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('SaleProcessModal', () => {
  it('closes and clears the cart when the sale is created but the payment fails', async () => {
    // Before the fix the modal stayed open with the cart intact, so retrying
    // "Registrar y Cobrar" or choosing "Pagar Después" created the sale again
    // and deducted its stock a second time.
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const request = input as Request
      const { pathname } = new URL(request.url)
      if (request.method === 'POST' && pathname === '/v1/sales/') return json(SALE, 201)
      if (request.method === 'POST' && pathname === `/v1/sales/${SALE.id}/payments/`) {
        return json({ detail: 'boom' }, 500)
      }
      if (pathname === '/v1/exchange-rates/today/') {
        return json({ bcv_rate: '100.00', parallel_rate: '120.00' })
      }
      return json({}, 404)
    })
    client.setConfig({ baseUrl: 'http://localhost', fetch: fetchMock })
    const onSuccess = vi.fn()

    render(
      <QueryClientProvider client={new QueryClient()}>
        <SaleProcessModal
          isOpen
          onClose={vi.fn()}
          cart={[{ product: { id: 'p1', name: 'Producto', selling_price_usd: '10.00' }, quantity: 1 }]}
          customerId=""
          branchId="branch-1"
          totalAmount={10}
          onSuccess={onSuccess}
        />
      </QueryClientProvider>,
    )

    const amount = screen.getByPlaceholderText('0.00')
    await userEvent.clear(amount)
    await userEvent.type(amount, '1000')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar y Cobrar' }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    const saleCreates = fetchMock.mock.calls.filter(([input]) => {
      const request = input as Request
      return request.method === 'POST' && new URL(request.url).pathname === '/v1/sales/'
    })
    expect(saleCreates).toHaveLength(1)
  })
})
