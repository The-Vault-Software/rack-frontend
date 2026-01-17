import { useInfiniteQuery } from '@tanstack/react-query';
import { v1SalesListInfiniteOptions } from '../../../client/@tanstack/react-query.gen';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Download, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useInView } from 'react-intersection-observer';
import Modal from '../../../components/ui/Modal';
import ActionConfirmationModal from '../../../components/ui/ActionConfirmationModal';
import PaymentForm from './PaymentForm';
import type { SaleList } from '../../../client/types.gen';
import { useBranch } from '../../../context/BranchContext';

export default function AccountsReceivable() {
  const { selectedBranch } = useBranch();
  const [selectedSale, setSelectedSale] = useState<SaleList | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmCloseOpen, setIsConfirmCloseOpen] = useState(false);
  const { ref, inView } = useInView();

  const { 
    data: salesData, 
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    ...v1SalesListInfiniteOptions({
      // @ts-expect-error - Query params might not be fully typed
      query: { branch: selectedBranch?.id }
    }),
    enabled: !!selectedBranch?.id,
    getNextPageParam: (lastPage) => {
      // @ts-expect-error - Backend response has links.next
      if (lastPage.links?.next) {
        // @ts-expect-error - Backend response has current_page
        return lastPage.current_page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  // Fetch next page when scrolled to bottom
  if (inView && hasNextPage && !isFetchingNextPage) {
    fetchNextPage();
  }

  const sales = salesData?.pages.flatMap(page => page.results) || [];
  const pendingSales = sales.filter(
    (sale) => sale.payment_status !== 'PAID' && sale.payment_status !== 'OVERPAID'
  );

  const handleCollectClick = (sale: SaleList) => {
    setSelectedSale(sale);
    setIsModalOpen(true);
  };

  const handleModalCloseAttempt = () => {
    setIsConfirmCloseOpen(true);
  };

  const confirmClosePayment = () => {
    setIsConfirmCloseOpen(false);
    setIsModalOpen(false);
    setSelectedSale(null);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Cargando cuentas por cobrar...</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total (USD)</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pagado</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pendiente</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
            <th className="relative px-6 py-3">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {pendingSales.map((sale) => {
            const total = parseFloat(sale.total_amount_usd || '0');
            const paid = parseFloat(sale.total_paid || '0');
            const pending = total - paid;
            
            return (
              <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(new Date(sale.created_at), 'dd/MM/yyyy', { locale: es })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {sale.customer_name || 'Consumidor Final'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                  ${total.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                  ${paid.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-bold">
                  ${pending.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    sale.payment_status === 'PARTIALLY_PAID' 
                      ? 'bg-yellow-100 text-yellow-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {sale.payment_status === 'PARTIALLY_PAID' ? 'Parcial' : 'Pendiente'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    onClick={() => handleCollectClick(sale)}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Cobrar
                  </button>
                </td>
              </tr>
            );
          })}
          {pendingSales.length === 0 && (
            <tr>
              <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                <div className="flex flex-col items-center">
                  <AlertCircle className="h-8 w-8 text-gray-300 mb-2" />
                  <p>No hay cuentas por cobrar pendientes.</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Infinite Scroll Trigger */}
      <div ref={ref} className="py-4 flex justify-center">
        {isFetchingNextPage ? (
          <div className="text-gray-500 text-sm animate-pulse flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
            <span>Cargando más cuentas...</span>
          </div>
        ) : hasNextPage ? (
          <span className="text-transparent">Cargar más</span>
        ) : pendingSales.length > 0 ? (
          <span className="text-gray-400 text-sm italic">No hay más cuentas por cobrar.</span>
        ) : null}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleModalCloseAttempt}
        title={`Registrar Cobro - Venta #${selectedSale?.seq_number}`}
      >
        {selectedSale && (
          <PaymentForm
            type="sale"
            id={selectedSale.id}
            pendingAmount={parseFloat(selectedSale.total_amount_usd || '0') - parseFloat(selectedSale.total_paid || '0')}
            onSuccess={() => setIsModalOpen(false)}
          />
        )}
      </Modal>

      <ActionConfirmationModal
        isOpen={isConfirmCloseOpen}
        onClose={() => setIsConfirmCloseOpen(false)}
        onConfirm={confirmClosePayment}
        title="¿Salir sin cobrar?"
        description="¿Estás seguro que no quieres cobrar la venta?"
        confirmText="Confirmar Salida"
        cancelText="Mantenerse"
        variant="warning"
      />
    </div>
  );
}
