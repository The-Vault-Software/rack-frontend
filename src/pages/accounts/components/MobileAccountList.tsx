
import React from 'react';
import { CreditCard, Calendar, Hash, User, AlertCircle, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AccountList } from '../../../client/types.gen';

interface MobileAccountListProps {
  accounts: AccountList[];
  onPay: (account: AccountList) => void;
  onViewDetail: (id: string) => void;
}

const MobileAccountList: React.FC<MobileAccountListProps> = ({
  accounts,
  onPay,
  onViewDetail,
}) => {
  if (accounts.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 bg-white rounded-lg border border-gray-100 shadow-sm">
        <AlertCircle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
        No se encontraron cuentas.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-1">
      {accounts.map((account) => {
        const total = parseFloat(account.total_amount_usd || '0');
        const paid = parseFloat(account.total_paid || '0');
        const pending = total - paid;

        return (
          <div key={account.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden active:scale-[0.98] transition-all duration-200">
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
                <span className={`px-2 py-1 text-[10px] font-bold rounded-lg ${
                  account.payment_status === 'PAID' 
                    ? 'bg-green-100 text-green-700' 
                    : account.payment_status === 'PARTIALLY_PAID'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {account.payment_status === 'PAID' ? 'PAGADO' : account.payment_status === 'PARTIALLY_PAID' ? 'PARCIAL' : 'PENDIENTE'}
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

                <div className="mt-4 flex items-center justify-end gap-2">
                 {account.payment_status !== 'PAID' && (
                  <button
                    onClick={() => onPay(account)}
                    className="flex-1 flex items-center justify-center px-4 py-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 active:bg-blue-200 transition-colors border border-blue-100 cursor-pointer"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Pagar
                  </button>
                )}
                 <button
                    onClick={() => onViewDetail(account.id)}
                    className="flex-none flex items-center justify-center p-2 text-gray-500 bg-gray-50 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors border border-gray-100 cursor-pointer"
                  >
                    <Eye className="h-5 w-5" />
                  </button>
                </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MobileAccountList;
