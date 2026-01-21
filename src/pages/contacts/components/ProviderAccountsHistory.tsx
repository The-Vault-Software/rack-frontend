import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { v1AccountsListInfiniteOptions } from '../../../client/@tanstack/react-query.gen';
import { useInView } from 'react-intersection-observer';
import { Trash2, Calendar, User, DollarSign, CreditCard, AlertCircle, Hash } from 'lucide-react';
import ActionConfirmationModal from '../../../components/ui/ActionConfirmationModal';
import Modal from '../../../components/ui/Modal';
import PaymentForm from '../../accounts/components/PaymentForm';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AccountList } from '../../../client/types.gen';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { cn } from '../../../lib/utils';
import MobileAccountList from '../../accounts/components/MobileAccountList';
import AccountDetail from '../../accounts/components/AccountDetail';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { v1AccountsDestroyMutation } from '../../../client/@tanstack/react-query.gen';
import { toast } from 'sonner';

interface ProviderAccountsHistoryProps {
  providerId: string;
}

export default function ProviderAccountsHistory({ providerId }: ProviderAccountsHistoryProps) {
  const [selectedAccount, setSelectedAccount] = useState<AccountList | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isConfirmCloseOpen, setIsConfirmCloseOpen] = useState(false);
  const [selectedDetailAccountId, setSelectedDetailAccountId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<AccountList | null>(null);

  const queryClient = useQueryClient();

  const { ref, inView } = useInView();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const { 
    data, 
    isLoading, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useInfiniteQuery({
    ...v1AccountsListInfiniteOptions(
      // @ts-expect-error - Query params might not be fully typed
      { query: { provider_id: providerId } }
    ),
    enabled: !!providerId,
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

  const accounts = data?.pages.flatMap(page => page.results) || [];

  const handlePayClick = (account: AccountList) => {
    setSelectedAccount(account);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentModalCloseAttempt = () => {
    setIsConfirmCloseOpen(true);
  };

  const confirmClosePayment = () => {
    setIsConfirmCloseOpen(false);
    setIsPaymentModalOpen(false);
    setSelectedAccount(null);
  };

  const handleViewDetail = (id: string) => {
    setSelectedDetailAccountId(id);
    setIsDetailModalOpen(true);
  };

  const { mutate: deleteAccount, isPending: isDeleting } = useMutation({
    ...v1AccountsDestroyMutation(),
    onSuccess: () => {
      toast.success('Cuenta eliminada correctamente');
      queryClient.invalidateQueries({ queryKey: ['v1AccountsList'] });
      setIsDeleteModalOpen(false);
      setAccountToDelete(null);
    },
    onError: () => {
      toast.error('Error al eliminar la cuenta');
    }
  });

  const handleDeleteClick = (account: AccountList) => {
    setAccountToDelete(account);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (accountToDelete) {
      deleteAccount({ path: { id: accountToDelete.id } });
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Cargando historial de cuentas...</div>;
  }

  return (
    <div className={cn(
      "overflow-x-auto",
      isMobile && "overflow-visible"
    )}>
      {isMobile ? (
        <MobileAccountList 
          accounts={accounts}
          onPay={handlePayClick}
          onViewDetail={handleViewDetail}
          onDelete={handleDeleteClick}
        />
      ) : (
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
                  <span>Proveedor</span>
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                 <div className="flex items-center space-x-1">
                  <DollarSign className="h-3 w-3" />
                  <span>Total (USD)</span>
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pagado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pendiente</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {accounts.map((account) => {
               const total = parseFloat(account.total_amount_usd || '0');
               const paid = parseFloat(account.total_paid || '0');
               const pending = total - paid;

               return (
              <tr key={account.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  #{account.seq_number}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {format(new Date(account.created_at), "dd/MM/yyyy", { locale: es })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {account.provider_name || 'Proveedor Desconocido'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                  ${total.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                  ${paid.toFixed(2)}
                </td>
                 <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-bold">
                   ${pending.toFixed(2)}
                 </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-bold rounded-full ${
                    account.payment_status === 'PAID' 
                      ? 'bg-green-100 text-green-800' 
                      : account.payment_status === 'PARTIALLY_PAID'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {account.payment_status === 'PAID' ? 'Pagado' : account.payment_status === 'PARTIALLY_PAID' ? 'Parcial' : 'Pendiente'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  {account.payment_status === 'PENDING' && (
                    <button 
                      onClick={() => handleDeleteClick(account)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 cursor-pointer"
                      title="Eliminar (Invalidar)"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Eliminar
                    </button>
                  )}
                  {account.payment_status !== 'PAID' && (
                    <button 
                      onClick={() => handlePayClick(account)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                      title="Pagar"
                    >
                      <CreditCard className="h-3 w-3 mr-1" />
                      Pagar
                    </button>
                  )}
                </td>
              </tr>
            )})}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                   <div className="flex flex-col items-center">
                    <AlertCircle className="h-8 w-8 text-gray-300 mb-2" />
                    <p>No se encontraron cuentas para este proveedor.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* Infinite Scroll Trigger */}
      <div ref={ref} className="py-4 flex justify-center">
        {isFetchingNextPage ? (
          <div className="text-gray-500 text-sm animate-pulse flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
            <span>Cargando más cuentas...</span>
          </div>
        ) : hasNextPage ? (
          <span className="text-transparent">Cargar más</span>
        ) : accounts.length > 0 ? (
          <span className="text-gray-400 text-sm italic">No hay más cuentas para mostrar.</span>
        ) : null}
      </div>

      <Modal
        isOpen={isPaymentModalOpen}
        onClose={handlePaymentModalCloseAttempt}
        title={`Registrar Pago - Compra #${selectedAccount?.seq_number}`}
      >
        {selectedAccount && (
          <PaymentForm
            type="account"
            id={selectedAccount.id}
            pendingAmount={parseFloat(selectedAccount.total_amount_usd || '0') - parseFloat(selectedAccount.total_paid || '0')}
            onSuccess={() => {
                // Ideally invalidate queries here.
               setIsPaymentModalOpen(false); 
            }}
          />
        )}
      </Modal>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Detalles de la Cuenta"
        maxWidth="max-w-4xl"
      >
        {selectedDetailAccountId && (
          <AccountDetail accountId={selectedDetailAccountId} />
        )}
      </Modal>

      <ActionConfirmationModal
        isOpen={isConfirmCloseOpen}
        onClose={() => setIsConfirmCloseOpen(false)}
        onConfirm={confirmClosePayment}
        title="¿Salir sin pagar?"
        description="¿Estás seguro que no quieres pagar la compra?"
        confirmText="Confirmar Salida"
        cancelText="Mantenerse"
        variant="warning"
      />

      <ActionConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title={`¿Eliminar Cuenta #${accountToDelete?.seq_number}?`}
        description="Esta acción invalidará la cuenta de forma permanente. El stock de los productos incluidos será descontado automáticamente. La cuenta quedará guardada internamente en nuestro sistema como 'Invalidada' para fines contables."
        confirmText={isDeleting ? "Eliminando..." : "Eliminar Cuenta"}
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
}
