import { useInfiniteQuery } from '@tanstack/react-query';
import { v1AccountsListInfiniteOptions } from '../../../client/@tanstack/react-query.gen';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CreditCard, AlertCircle, Calendar, Hash, User, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import Modal from '../../../components/ui/Modal';
import ActionConfirmationModal from '../../../components/ui/ActionConfirmationModal';
import PaymentForm from './PaymentForm';
import type { AccountList } from '../../../client/types.gen';
import { useBranch } from '../../../context/BranchContext';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { cn } from '../../../lib/utils';
import type { Options } from '../../../client/client/types.gen';
import type { V1AccountsListData } from '../../../client/types.gen';

type AccountsListOptions = Options<V1AccountsListData> & {
  query: {
    branch?: string;
    payment_status?: string;
  };
};

export default function AccountsPayable() {
  const { selectedBranch } = useBranch();
  const [selectedAccount, setSelectedAccount] = useState<AccountList | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmCloseOpen, setIsConfirmCloseOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { ref, inView } = useInView();

  const { 
    data, 
    isLoading, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useInfiniteQuery({
    ...v1AccountsListInfiniteOptions({
      query: { 
        branch: selectedBranch?.id,
        payment_status: 'PENDING,PARTIALLY_PAID'
      }
    } as AccountsListOptions),
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
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const accounts = data?.pages.flatMap(page => page.results) || [];
  const pendingAccounts = accounts.filter(
    (acc) => acc.payment_status !== 'PAID'
  );

  const handlePayClick = (account: AccountList) => {
    setSelectedAccount(account);
    setIsModalOpen(true);
  };

  const handleModalCloseAttempt = () => {
    setIsConfirmCloseOpen(true);
  };

  const confirmClosePayment = () => {
    setIsConfirmCloseOpen(false);
    setIsModalOpen(false);
    setSelectedAccount(null);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Cargando cuentas por pagar...</div>;
  }

  return (
    <div className={cn(isMobile && "px-2 py-4")}>
      {isMobile ? (
        /* Mobile Card View */
        <div className="space-y-3">
          {pendingAccounts.map((account) => {
            const total = parseFloat(account.total_amount_usd || '0');
            const paid = parseFloat(account.total_paid || '0');
            const pending = total - paid;
            
            return (
              <div key={account.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden active:scale-[0.98] transition-all">
                <div className="p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <Hash className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-gray-900">#{account.seq_number}</span>
                        <div className="flex items-center text-[10px] text-gray-500 mt-0.5">
                          <Calendar className="h-3 w-3 mr-1" />
                          {format(new Date(account.created_at), "dd/MM/yyyy", { locale: es })}
                        </div>
                      </div>
                    </div>
                    <span className={cn(
                      "px-2 py-1 text-[10px] font-bold rounded-lg",
                      account.payment_status === 'PARTIALLY_PAID' 
                        ? 'bg-amber-100 text-amber-700' 
                        : 'bg-red-100 text-red-700'
                    )}>
                      {account.payment_status === 'PARTIALLY_PAID' ? 'PARCIAL' : 'PENDIENTE'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-600">
                      <User className="h-4 w-4 mr-2 text-gray-400" />
                      <span className="font-medium truncate">{account.provider_name || 'Proveedor Desconocido'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 py-2 border-y border-gray-50">
                      <div className="text-center">
                        <span className="block text-[10px] text-gray-400 uppercase font-bold">Total</span>
                        <span className="text-xs font-bold text-gray-900">${total.toFixed(2)}</span>
                      </div>
                      <div className="text-center border-x border-gray-50">
                        <span className="block text-[10px] text-gray-400 uppercase font-bold">Pagado</span>
                        <span className="text-xs font-bold text-green-600">${paid.toFixed(2)}</span>
                      </div>
                      <div className="text-center">
                        <span className="block text-[10px] text-gray-400 uppercase font-bold">Pendiente</span>
                        <span className="text-xs font-bold text-red-600">${pending.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <button
                      onClick={() => handlePayClick(account)}
                      className="w-full flex items-center justify-center px-4 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-md shadow-blue-100"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Pagar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {pendingAccounts.length === 0 && (
            <div className="p-8 text-center text-gray-500 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <AlertCircle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              No hay cuentas por pagar pendientes.
            </div>
          )}
        </div>
      ) : (
        /* Desktop Table View */
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
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
              {pendingAccounts.map((account) => {
                const total = parseFloat(account.total_amount_usd || '0');
                const paid = parseFloat(account.total_paid || '0');
                const pending = total - paid;
                
                return (
                  <tr key={account.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(account.created_at), 'dd/MM/yyyy', { locale: es })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {account.provider_name || 'Proveedor Desconocido'}
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
                        account.payment_status === 'PARTIALLY_PAID' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {account.payment_status === 'PARTIALLY_PAID' ? 'Parcial' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => handlePayClick(account)}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <CreditCard className="h-3 w-3 mr-1" />
                        Pagar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {pendingAccounts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <AlertCircle className="h-8 w-8 text-gray-300 mb-2" />
                      <p>No hay cuentas por pagar pendientes.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Infinite Scroll Trigger */}
      <div ref={ref} className="py-8 flex justify-center">
        {isFetchingNextPage ? (
          <div className="flex flex-col items-center gap-2 text-blue-600">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-xs font-semibold">Cargando más cuentas...</span>
          </div>
        ) : hasNextPage ? (
          <div className="h-4" /> // Spacing for intersection observer
        ) : pendingAccounts.length > 0 ? (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <div className="h-px w-12 bg-gray-200" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Fin de la lista</span>
          </div>
        ) : null}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleModalCloseAttempt}
        title={`Registrar Pago - Compra #${selectedAccount?.seq_number}`}
      >
        {selectedAccount && (
          <PaymentForm
            type="account"
            id={selectedAccount.id}
            pendingAmount={parseFloat(selectedAccount.total_amount_usd || '0') - parseFloat(selectedAccount.total_paid || '0')}
            onSuccess={() => setIsModalOpen(false)}
          />
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
    </div>
  );
}
