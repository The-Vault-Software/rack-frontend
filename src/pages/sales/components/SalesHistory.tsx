import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { v1SalesListInfiniteOptions } from '../../../client/@tanstack/react-query.gen';
import { useBranch } from '../../../context/BranchContext';
import { useInView } from 'react-intersection-observer';
import { Calendar, User, DollarSign, Eye, HandCoins, Hash } from 'lucide-react';
import ActionConfirmationModal from '../../../components/ui/ActionConfirmationModal';
import Modal from '../../../components/ui/Modal';
import SaleDetail from './SaleDetail';
import PaymentForm from '../../accounts/components/PaymentForm';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { SaleList } from '../../../client/types.gen';

export default function SalesHistory() {
  const { selectedBranch } = useBranch();
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<SaleList | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isConfirmCloseOpen, setIsConfirmCloseOpen] = useState(false);

  const { ref, inView } = useInView();

  const { 
    data, 
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
      // @ts-expect-error - Backend response has links.next but types say 'next'
      if (lastPage.links?.next) {
        // @ts-expect-error - Backend response has current_page but types don't
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

  const sales = data?.pages.flatMap(page => page.results) || [];

  const handleViewDetail = (id: string) => {
    setSelectedSaleId(id);
    setIsDetailModalOpen(true);
  };

  const handleCollectPayment = (sale: SaleList) => {
    setSelectedSale(sale);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentModalCloseAttempt = () => {
    setIsConfirmCloseOpen(true);
  };

  const confirmClosePayment = () => {
    setIsConfirmCloseOpen(false);
    setIsPaymentModalOpen(false);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Cargando historial de ventas...</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="flex items-center space-x-1">
                <Hash className="h-3 w-3" />
                <span>Nro</span>
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="flex items-center space-x-1">
                <Calendar className="h-3 w-3" />
                <span>Fecha</span>
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
               <div className="flex items-center space-x-1">
                <User className="h-3 w-3" />
                <span>Cliente</span>
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
               <div className="flex items-center space-x-1">
                <DollarSign className="h-3 w-3" />
                <span>Total</span>
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sales.map((sale) => (
            <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                #{sale.seq_number}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {sale.customer_name || 'Consumidor Final'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                ${parseFloat(sale.total_amount_usd || '0').toFixed(2)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 inline-flex text-xs leading-5 font-bold rounded-full ${
                  sale.payment_status === 'PAID' 
                    ? 'bg-green-100 text-green-800' 
                    : sale.payment_status === 'PARTIALLY_PAID'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {sale.payment_status === 'PAID' ? 'Pagado' : sale.payment_status === 'PARTIALLY_PAID' ? 'Parcial' : 'Pendiente'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                {sale.payment_status !== 'PAID' && (
                  <button 
                    onClick={() => handleCollectPayment(sale)}
                    className="text-green-600 hover:text-green-900 bg-green-50 p-2 rounded-full transition-colors cursor-pointer"
                    title="Cobrar"
                  >
                    <HandCoins className="h-4 w-4" />
                  </button>
                )}
                <button 
                  onClick={() => handleViewDetail(sale.id)}
                  className="text-blue-600 hover:text-blue-900 bg-blue-50 p-2 rounded-full transition-colors cursor-pointer"
                  title="Ver detalles"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
          {sales.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                No se encontraron ventas en esta sucursal.
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
            <span>Cargando más ventas...</span>
          </div>
        ) : hasNextPage ? (
          <span className="text-transparent">Cargar más</span>
        ) : sales.length > 0 ? (
          <span className="text-gray-400 text-sm italic">No hay más ventas para mostrar.</span>
        ) : null}
      </div>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Detalles de la Venta"
      >
        {selectedSaleId && <SaleDetail saleId={selectedSaleId} />}
      </Modal>

      <Modal
        isOpen={isPaymentModalOpen}
        onClose={handlePaymentModalCloseAttempt}
        title={`Registrar Cobro - Venta #${selectedSale?.seq_number}`}
      >
        {selectedSale && (
          <PaymentForm
            type="sale"
            id={selectedSale.id}
            pendingAmount={parseFloat(selectedSale.total_amount_usd || '0') - parseFloat(selectedSale.total_paid || '0')}
            onSuccess={() => {
              setIsPaymentModalOpen(false);
              // The sale list will auto-refresh due to the mutation's invalidateQueries (hopefully)
              // If not, we might need a refetch locally, but standard practice is global cache invalidation.
            }}
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
