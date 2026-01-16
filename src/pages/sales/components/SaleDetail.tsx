import { useQuery } from '@tanstack/react-query';
import { salesRetrieveOptions } from '../../../client/@tanstack/react-query.gen';
import { Package, User, Calendar, CreditCard, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SaleDetailProps {
  saleId: string;
}

export default function SaleDetail({ saleId }: SaleDetailProps) {
  const { data: sale, isLoading, error } = useQuery(salesRetrieveOptions({
    path: { id: saleId }
  }));

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="text-gray-500 text-sm animate-pulse">Cargando detalles de la venta...</p>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 font-medium">Error al cargar los detalles</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          <div className="flex items-center text-sm text-gray-500">
            <Receipt className="h-4 w-4 mr-2" />
            <span className="font-semibold uppercase tracking-wider text-[10px]">Información de Venta</span>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Venta #{sale.seq_number}</p>
            <div className="flex items-center text-xs text-gray-500 mt-1">
              <Calendar className="h-3 w-3 mr-1" />
              {format(new Date(sale.created_at), "PPP p", { locale: es })}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          <div className="flex items-center text-sm text-gray-500">
            <User className="h-4 w-4 mr-2" />
            <span className="font-semibold uppercase tracking-wider text-[10px]">Cliente</span>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{sale.customer_name || 'Consumidor Final'}</p>
            <p className="text-xs text-gray-500">ID: {sale.customer || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Product List */}
      <div>
        <div className="flex items-center text-sm text-gray-500 mb-3 ml-1">
          <Package className="h-4 w-4 mr-2" />
          <span className="font-semibold uppercase tracking-wider text-[10px]">Productos</span>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Producto</th>
                <th className="px-4 py-2 text-center text-[10px] font-bold text-gray-500 uppercase">Cant.</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">P. Unit</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Subtotal</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sale.sale_details.map((detail) => (
                <tr key={detail.id} className="text-sm">
                  <td className="px-4 py-3 text-gray-900 font-medium">{detail.product_name}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{detail.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-600">${parseFloat(detail.unit_price || '0').toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    ${(detail.quantity * parseFloat(detail.unit_price || '0')).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex items-center text-sm text-blue-600 mb-3">
          <CreditCard className="h-4 w-4 mr-2" />
          <span className="font-bold uppercase tracking-wider text-[10px]">Resumen Financiero</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-blue-700">Monto Total:</span>
            <span className="font-bold text-blue-900">${parseFloat(sale.total_amount_usd || '0').toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-blue-100 pt-2">
            <span className="text-blue-700 font-medium">Monto Pagado:</span>
            <span className="font-bold text-green-700">${parseFloat(sale.total_paid || '0').toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg border-t-2 border-blue-200 pt-2">
            <span className="text-blue-800 font-black">Pendiente:</span>
            <span className="font-black text-red-600">
              ${(parseFloat(sale.total_amount_usd || '0') - parseFloat(sale.total_paid || '0')).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
