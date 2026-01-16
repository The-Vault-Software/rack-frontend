import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { salesRetrieveOptions, salesPaymentsListOptions, exchangeRatesRetrieveOptions, exchangeRatesTodayRetrieveOptions } from '../../../client/@tanstack/react-query.gen';
import { Package, User, Calendar, CreditCard, Receipt, Search, Info } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Modal from '../../../components/ui/Modal';
import type { SalePayment } from '../../../client/types.gen';

interface SaleDetailProps {
  saleId: string;
}

function PaymentRow({ payment }: { payment: SalePayment }) {
  const { data: xr } = useQuery({
    ...exchangeRatesRetrieveOptions({
      path: { id: payment.exchange_rate as string }
    }),
    enabled: !!payment.exchange_rate
  });

  return (
    <tr className="text-sm">
      <td className="px-4 py-3 text-gray-600">
        {format(new Date(payment.payment_date), "dd/MM/yyyy HH:mm")}
      </td>
      <td className="px-4 py-3 text-black-600">
        {payment.currency}
      </td>
      <td className="px-4 py-3">
        <span className="font-medium text-gray-900">{payment.payment_method}</span>
        <div className="text-[10px] text-gray-400 font-mono mt-0.5">
          {payment.currency} @ {xr ? (
            <span className="flex gap-1.5">
              <span title="Tasa BCV" className="text-blue-600/70">BCV: {parseFloat(xr.bcv_rate).toFixed(2)}</span>
              <span className="text-gray-300">|</span>
              <span title="Tasa Paralelo" className="text-purple-600/70">PAR: {parseFloat(xr.parallel_rate).toFixed(2)}</span>
            </span>
          ) : payment.exchange_rate ? 'Cargando tasa...' : '-'}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        {parseFloat(payment.discount) !== 0 ? (
          <div className="flex flex-col items-end">
            <span className="text-blue-500 font-bold">%{parseFloat(payment.discount).toFixed(2)}</span>
            <span className="text-[10px] text-gray-400 font-medium italic">
              -${(parseFloat(payment.total_amount_usd) * (parseFloat(payment.discount) / 100)).toFixed(2)}
            </span>
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-right text-gray-600 font-medium">
        Bs. {(parseFloat(payment.total_amount_ves) * (1 - parseFloat(payment.discount) / 100)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="px-4 py-3 text-right font-bold text-blue-600">
        ${(parseFloat(payment.total_amount_usd) * (1 - parseFloat(payment.discount) / 100)).toFixed(2)}
      </td>
    </tr>
  );
}

export default function SaleDetail({ saleId }: SaleDetailProps) {
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);

  const { data: sale, isLoading, error } = useQuery(salesRetrieveOptions({
    path: { id: saleId }
  }));

  const { data: payments, isLoading: isLoadingPayments } = useQuery({
    ...salesPaymentsListOptions({
      path: { sale_id: saleId }
    }),
    enabled: showPaymentsModal
  });

  const { data: ratesData } = useQuery({
    ...exchangeRatesTodayRetrieveOptions(),
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  const rates = ratesData as { bcv_rate: string; parallel_rate: string } | undefined;

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
                <th className="px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">P. Unit (USD)</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Subtotal (Bs)</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Subtotal (USD)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sale.sale_details.map((detail) => (
                <tr key={detail.id} className="text-sm">
                  <td className="px-4 py-3 text-gray-900 font-medium">{detail.product_name}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{detail.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-600">${parseFloat(detail.unit_price || '0').toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">
                    {rates ? (
                      `Bs. ${((detail.quantity * parseFloat(detail.unit_price || '0')) * parseFloat(rates.bcv_rate)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    ) : '-'}
                  </td>
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
      <div className="bg-blue-50 p-4 rounded-lg relative overflow-hidden group">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center text-sm text-blue-600">
            <CreditCard className="h-4 w-4 mr-2" />
            <span className="font-bold uppercase tracking-wider text-[10px]">Resumen Financiero</span>
          </div>
          <button
            onClick={() => setShowPaymentsModal(true)}
            className="p-1.5 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200 transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight"
            title="Ver detalles de pagos"
          >
            <Search className="h-3.5 w-3.5" />
            Pagos
          </button>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-blue-700">Monto Total:</span>
            <div className="text-right">
              <span className="font-bold text-blue-900 block">${parseFloat(sale.total_amount_usd || '0').toFixed(2)}</span>
              {rates && (
                <span className="text-[10px] text-blue-600 font-medium italic">
                  ≈ Bs. {(parseFloat(sale.total_amount_usd || '0') * parseFloat(rates.bcv_rate)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </div>
          <div className="flex justify-between text-lg border-t-2 border-blue-200 pt-2">
            <span className="text-blue-800 font-black">Pendiente:</span>
            <div className="text-right">
              <span className="font-black text-red-600 block">
                ${(parseFloat(sale.total_amount_usd || '0') - parseFloat(sale.total_paid || '0')).toFixed(2)}
              </span>
              {rates && (
                <span className="text-xs text-red-500 font-bold italic">
                  ≈ Bs. {((parseFloat(sale.total_amount_usd || '0') - parseFloat(sale.total_paid || '0')) * parseFloat(rates.bcv_rate)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payments Detail Modal */}
      <Modal
        isOpen={showPaymentsModal}
        onClose={() => setShowPaymentsModal(false)}
        title={`Detalle de Pagos - Venta #${sale.seq_number}`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          {isLoadingPayments ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <p className="text-gray-500 text-sm">Cargando pagos...</p>
            </div>
          ) : payments && payments.length > 0 ? (
            <div className="overflow-hidden border rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Fecha</th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Moneda</th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Método</th>
                    <th className="px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Ajuste/Desc.</th>
                    <th className="px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Monto (Bs)</th>
                    <th className="px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Monto (USD)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <PaymentRow key={payment.id} payment={payment} />
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr className="text-sm font-bold">
                    <td colSpan={3} className="px-4 py-2 text-right text-gray-500 uppercase text-[10px]">Total Pagado</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-gray-400">Total Desc:</span>
                        <span className="text-blue-500">
                          -${payments.reduce((acc, p) => acc + (parseFloat(p.total_amount_usd) * parseFloat(p.discount) / 100), 0).toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      Bs. {payments.reduce((acc, p) => acc + (parseFloat(p.total_amount_ves) * (1 - parseFloat(p.discount) / 100)), 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2 text-right text-green-700">${parseFloat(sale.total_paid).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <Info className="h-8 w-8 text-gray-300 mb-2" />
              <p className="text-gray-500 text-sm">No se encontraron pagos registrados para esta venta.</p>
            </div>
          )}
          
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setShowPaymentsModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


