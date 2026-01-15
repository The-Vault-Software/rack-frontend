import { useQuery } from '@tanstack/react-query';
import { accountsListOptions } from '../../../client/@tanstack/react-query.gen';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CreditCard, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import Modal from '../../../components/ui/Modal';
import PaymentForm from './PaymentForm';
import type { AccountList } from '../../../client/types.gen';
import { useBranch } from '../../../context/BranchContext';

export default function AccountsPayable() {
  const { selectedBranch } = useBranch();
  const [selectedAccount, setSelectedAccount] = useState<AccountList | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: accountsData, isLoading } = useQuery({
    ...accountsListOptions({
      // @ts-expect-error - Query params might not be fully typed
      query: { branch: selectedBranch?.id }
    }),
    enabled: !!selectedBranch?.id
  });

  const pendingAccounts = (Array.isArray(accountsData) ? accountsData : []).filter(
    (acc) => acc.payment_status !== 'PAID'
  );

  const handlePayClick = (account: AccountList) => {
    setSelectedAccount(account);
    setIsModalOpen(true);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Cargando cuentas por pagar...</div>;
  }

  return (
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
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
    </div>
  );
}
