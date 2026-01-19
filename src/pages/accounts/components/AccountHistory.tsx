import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { v1AccountsListInfiniteOptions } from '../../../client/@tanstack/react-query.gen';
import { useBranch } from '../../../context/BranchContext';
import { useInView } from 'react-intersection-observer';
import { Calendar, User, DollarSign, Eye, HandCoins, Hash } from 'lucide-react';
import ActionConfirmationModal from '../../../components/ui/ActionConfirmationModal';
import Modal from '../../../components/ui/Modal';
import AccountDetail from './AccountDetail';
import PaymentForm from '../../accounts/components/PaymentForm';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AccountList } from '../../../client/types.gen';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { cn } from '../../../lib/utils';
import MobileAccountList from './MobileAccountList';

export default function AccountHistory({ providerId }: { providerId?: string }) {
  const { selectedBranch } = useBranch();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<AccountList | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isConfirmCloseOpen, setIsConfirmCloseOpen] = useState(false);

  const { ref, inView } = useInView();

  const queryOptions = providerId 
    ? { query: { provider_id: providerId } }
    : { query: { branch: selectedBranch?.id } };

  const { 
    data, 
    isLoading, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useInfiniteQuery({
    ...v1AccountsListInfiniteOptions(
      // @ts-expect-error - Query params support more than what types say
      queryOptions
    ),
    enabled: !!(providerId || selectedBranch?.id),
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

  const handleViewDetail = (id: string) => {
    setSelectedAccountId(id);
    setIsDetailModalOpen(true);
  };

  const handlePayAccount = (account: AccountList) => {
    setSelectedAccount(account);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentModalCloseAttempt = () => {
    setIsConfirmCloseOpen(true);
  };

  const confirmClosePayment = () => {
    setIsConfirmCloseOpen(false);
    setIsPaymentModalOpen(false);
  };

  const isMobile = useMediaQuery('(max-width: 768px)');

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
          onViewDetail={handleViewDetail}
          onPay={handlePayAccount}
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
            {accounts.map((account) => (
              <tr key={account.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  #{account.seq_number}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {format(new Date(account.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {account.provider_name || 'Proveedor Desconocido'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                  ${parseFloat(account.total_amount_usd || '0').toFixed(2)}
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
                  {account.payment_status !== 'PAID' && (
                    <button 
                      onClick={() => handlePayAccount(account)}
                      className="text-green-600 hover:text-green-900 bg-green-50 p-2 rounded-full transition-colors cursor-pointer"
                      title="Pagar"
                    >
                      <HandCoins className="h-4 w-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => handleViewDetail(account.id)}
                    className="text-blue-600 hover:text-blue-900 bg-blue-50 p-2 rounded-full transition-colors cursor-pointer"
                    title="Ver detalles"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  {providerId ? 'No se encontraron cuentas para este proveedor.' : 'No se encontraron cuentas en esta sucursal.'}
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
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Detalles de la Cuenta"
      >
        {selectedAccountId && <AccountDetail accountId={selectedAccountId} />}
      </Modal>

      <Modal
        isOpen={isPaymentModalOpen}
        onClose={handlePaymentModalCloseAttempt}
        title={`Registrar Pago - Cuenta #${selectedAccount?.seq_number}`}
      >
        {selectedAccount && (
          <PaymentForm
            type="account"
            id={selectedAccount.id}
            pendingAmount={parseFloat(selectedAccount.total_amount_usd || '0') - parseFloat(selectedAccount.total_paid || '0')}
            onSuccess={() => {
              setIsPaymentModalOpen(false);
            }}
          />
        )}
      </Modal>

      <ActionConfirmationModal
        isOpen={isConfirmCloseOpen}
        onClose={() => setIsConfirmCloseOpen(false)}
        onConfirm={confirmClosePayment}
        title="¿Salir sin pagar?"
        description="¿Estás seguro que no quieres pagar la cuenta?"
        confirmText="Confirmar Salida"
        cancelText="Mantenerse"
        variant="warning"
      />
    </div>
  );
}
