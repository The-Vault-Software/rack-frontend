
import React from 'react';
import { Trash2, Eye, HandCoins, Calendar, Hash, User, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { SaleList } from '../../../client/types.gen';

interface MobileSaleListProps {
  sales: SaleList[];
  onViewDetail: (id: string) => void;
  onCollectPayment: (sale: SaleList) => void;
  onDelete: (sale: SaleList) => void;
}

const MobileSaleList: React.FC<MobileSaleListProps> = ({
  sales,
  onViewDetail,
  onCollectPayment,
  onDelete,
}) => {
  if (sales.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 bg-white rounded-lg border border-gray-100 shadow-sm">
        No se encontraron ventas.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-1">
      {sales.map((sale) => (
        <div key={sale.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden active:scale-[0.98] transition-all duration-200">
          <div className="p-4">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <Hash className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-sm font-bold text-gray-900">#{sale.seq_number}</span>
                  <div className="flex items-center text-[10px] text-gray-500 mt-0.5">
                    <Calendar className="h-3 w-3 mr-1" />
                    {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                  </div>
                </div>
              </div>
              <span className={`px-2 py-1 text-[10px] font-bold rounded-lg ${
                sale.payment_status === 'PAID' 
                  ? 'bg-green-100 text-green-700' 
                  : sale.payment_status === 'PARTIALLY_PAID'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {sale.payment_status === 'PAID' ? 'PAGADO' : sale.payment_status === 'PARTIALLY_PAID' ? 'PARCIAL' : 'PENDIENTE'}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
                <div className="flex items-center text-sm text-gray-600">
                  <User className="h-4 w-4 mr-2 text-gray-400" />
                  <span className="font-medium truncate max-w-[150px]">
                    {sale.customer_name || 'Consumidor Final'}
                  </span>
                </div>
                <div className="flex items-center text-sm font-bold text-gray-900">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  {parseFloat(sale.total_amount_usd || '0').toFixed(2)}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => onViewDetail(sale.id)}
                className="flex-1 min-w-[100px] flex items-center justify-center px-3 py-2 text-sm font-semibold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 active:bg-blue-200 transition-colors border border-blue-100"
              >
                <Eye className="h-4 w-4 mr-2" />
                Detalles
              </button>
              {sale.payment_status === 'PENDING' && (
                <button
                  onClick={() => onDelete(sale)}
                  className="flex-1 min-w-[100px] flex items-center justify-center px-3 py-2 text-sm font-semibold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 active:bg-red-200 transition-colors border border-red-100"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </button>
              )}
              {sale.payment_status !== 'PAID' && (
                <button
                  onClick={() => onCollectPayment(sale)}
                  className="flex-1 min-w-[100px] flex items-center justify-center px-3 py-2 text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-xl hover:bg-emerald-100 active:bg-emerald-200 transition-colors border border-emerald-100"
                >
                  <HandCoins className="h-4 w-4 mr-2" />
                  Cobrar
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MobileSaleList;
