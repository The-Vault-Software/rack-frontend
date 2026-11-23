import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { client } from '../../../client/client.gen'
import { BranchContext } from '../../../context/BranchContext'
import { analysisFixture } from '../../../test/inventoryAnalysisFixture'
import InventoryAnalytics from './InventoryAnalytics'

const exportMock = vi.hoisted(() => vi.fn())
vi.mock('../../../utils/inventoryAnalysisExport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utils/inventoryAnalysisExport')>()),
  exportInventoryAnalysis: exportMock,
}))

// Recharts needs a measured container; jsdom has none.
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }
})

const branch = { id: 'branch-1', name: 'Sucursal Centro' }

function setup() {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify(analysisFixture), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  client.setConfig({ baseUrl: 'http://localhost', fetch: fetchMock })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BranchContext.Provider value={{ selectedBranch: branch as never, setSelectedBranch: vi.fn(), branches: [branch as never], isLoading: false }}>
        <InventoryAnalytics />
      </BranchContext.Provider>
    </QueryClientProvider>,
  )
  return fetchMock
}

describe('InventoryAnalytics', () => {
  beforeEach(() => exportMock.mockReset())

  it('makes a single request for the selected branch, only when asked', async () => {
    const fetchMock = setup()
    expect(fetchMock).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /Comenzar Análisis/ }))
    await screen.findByText('Cambios de Precio Sugeridos')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = new URL((fetchMock.mock.calls[0] as unknown as [Request])[0].url)
    expect(url.pathname).toBe('/v1/inventory-analysis/')
    expect(url.searchParams.get('branch_id')).toBe('branch-1')
    expect(url.searchParams.get('window_days')).toBe('90')
    expect(url.searchParams.get('horizon_days')).toBe('60')
  })

  it('lists suggested price changes and filters liquidations', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /Comenzar Análisis/ }))
    const table = await screen.findByRole('table')

    expect(within(table).getByText('Pollo entero')).toBeInTheDocument()
    expect(within(table).getByText('Yogur')).toBeInTheDocument()
    expect(within(table).queryByText('Clavos')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Liquidar' }))
    expect(within(screen.getByRole('table')).queryByText('Pollo entero')).toBeNull()
  })

  it('exports the loaded analysis to Excel', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /Comenzar Análisis/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Exportar Excel/ }))
    expect(exportMock).toHaveBeenCalledWith(analysisFixture)
  })
})
