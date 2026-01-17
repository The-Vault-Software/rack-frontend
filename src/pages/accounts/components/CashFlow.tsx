import { useInfiniteQuery } from '@tanstack/react-query';
import { v1SalesListInfiniteOptions, v1AccountsListInfiniteOptions } from '../../../client/@tanstack/react-query.gen';
import { useInView } from 'react-intersection-observer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Clock, AlertCircle, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { useBranch } from '../../../context/BranchContext';

export default function CashFlow() {
  const { selectedBranch } = useBranch();
  const { ref, inView } = useInView();

  const { 
    data: salesData, 
    isLoading: isSalesLoading,
    fetchNextPage: fetchNextSalesPage,
    hasNextPage: hasNextSalesPage,
    isFetchingNextPage: isFetchingNextSalesPage
  } = useInfiniteQuery({
    ...v1SalesListInfiniteOptions({
      // @ts-expect-error - Query params might not be fully typed
      query: { branch: selectedBranch?.id }
    }),
    enabled: !!selectedBranch?.id,
    getNextPageParam: (lastPage) => {
      // @ts-expect-error - links.next exists in response
      if (lastPage.links?.next) {
        // @ts-expect-error - current_page exists in response
        return lastPage.current_page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  const { 
    data: accountsData, 
    isLoading: isAccountsLoading,
    fetchNextPage: fetchNextAccountsPage,
    hasNextPage: hasNextAccountsPage,
    isFetchingNextPage: isFetchingNextAccountsPage
  } = useInfiniteQuery({
    ...v1AccountsListInfiniteOptions({
      // @ts-expect-error - Query params might not be fully typed
      query: { branch: selectedBranch?.id }
    }),
    enabled: !!selectedBranch?.id,
    getNextPageParam: (lastPage) => {
      // @ts-expect-error - links.next exists in response
      if (lastPage.links?.next) {
        // @ts-expect-error - current_page exists in response
        return lastPage.current_page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  // Fetch next pages when scrolled to bottom
  if (inView) {
    if (hasNextSalesPage && !isFetchingNextSalesPage) {
      fetchNextSalesPage();
    }
    if (hasNextAccountsPage && !isFetchingNextAccountsPage) {
      fetchNextAccountsPage();
    }
  }

  const movements = useMemo(() => {
    const allSales = salesData?.pages.flatMap(page => page.results) || [];
    const allAccounts = accountsData?.pages.flatMap(page => page.results) || [];

    const sales = allSales.map(sale => ({
      id: sale.id,
      date: new Date(sale.created_at),
      type: 'IN' as const,
      description: `Venta #${sale.seq_number} - ${sale.customer_name || 'Consumidor Final'}`,
      amount: parseFloat(sale.total_paid || '0'),
      total: parseFloat(sale.total_amount_usd || '0'),
      status: sale.payment_status
    }));

    const accounts = allAccounts.map(acc => ({
      id: acc.id,
      date: new Date(acc.created_at),
      type: 'OUT' as const,
      description: `Compra #${acc.seq_number} - ${acc.provider_name || 'Proveedor'}`,
      amount: parseFloat(acc.total_paid || '0'),
      total: parseFloat(acc.total_amount_usd || '0'),
      status: acc.payment_status
    }));

    return [...sales, ...accounts].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [salesData, accountsData]);

  const summary = useMemo(() => {
    return movements.reduce((acc, curr) => {
      if (curr.type === 'IN') {
        acc.income += curr.amount;
      } else {
        acc.expense += curr.amount;
      }
      return acc;
    }, { income: 0, expense: 0 });
  }, [movements]);

  if (isSalesLoading || isAccountsLoading) {
    return <div className="p-8 text-center text-gray-500">Cargando flujo de caja...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-gray-50 border-b">
        <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500">
          <p className="text-sm text-gray-500 uppercase font-bold">Ingresos Totales (Pagados)</p>
          <div className="flex items-center justify-between mt-1">
            <h3 className="text-2xl font-bold text-green-600">${summary.income.toFixed(2)}</h3>
            <TrendingUp className="h-8 w-8 text-green-100" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-red-500">
          <p className="text-sm text-gray-500 uppercase font-bold">Egresos Totales (Pagados)</p>
          <div className="flex items-center justify-between mt-1">
            <h3 className="text-2xl font-bold text-red-600">${summary.expense.toFixed(2)}</h3>
            <TrendingDown className="h-8 w-8 text-red-100" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
          <p className="text-sm text-gray-500 uppercase font-bold">Balance Neto</p>
          <div className="flex items-center justify-between mt-1">
            <h3 className={`text-2xl font-bold ${summary.income - summary.expense >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              ${(summary.income - summary.expense).toFixed(2)}
            </h3>
            <Wallet className="h-8 w-8 text-blue-100" />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto Pagado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Doc</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {movements.map((m) => (
              <tr key={`${m.type}-${m.id}`} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <Clock className="h-3 w-3 mr-2 text-gray-400" />
                    {format(m.date, 'dd/MM/yyyy HH:mm', { locale: es })}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {m.description}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    m.type === 'IN' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {m.type === 'IN' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                    {m.type === 'IN' ? 'Ingreso' : 'Egreso'}
                  </span>
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${m.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                  {m.type === 'IN' ? '+' : '-'}${m.amount.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${m.total.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                   <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    m.status === 'PAID' ? 'bg-green-100 text-green-800' : 
                    m.status === 'PARTIALLY_PAID' ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-red-100 text-red-800'
                  }`}>
                    {m.status}
                  </span>
                </td>
              </tr>
            ))}
            {movements.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <AlertCircle className="h-8 w-8 text-gray-300 mb-2" />
                    <p>No hay movimientos registrados.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Infinite Scroll Trigger */}
      <div ref={ref} className="py-4 flex justify-center">
        {(isFetchingNextSalesPage || isFetchingNextAccountsPage) ? (
          <div className="text-gray-500 text-sm animate-pulse flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
            <span>Cargando más movimientos...</span>
          </div>
        ) : (hasNextSalesPage || hasNextAccountsPage) ? (
          <span className="text-transparent">Cargar más</span>
        ) : movements.length > 0 ? (
          <span className="text-gray-400 text-sm italic">No hay más movimientos para mostrar.</span>
        ) : null}
      </div>
    </div>
  );
}
