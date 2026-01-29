import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { v1SalesRetrieveOptions, v1SalesPaymentsListOptions, v1ExchangeRatesRetrieveOptions, v1ProductListOptions } from '../../../client/@tanstack/react-query.gen';
import { useExchangeRates } from '../../../hooks/useExchangeRates';
import { Package, User, Calendar, CreditCard, Receipt, Search, Info, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Modal from '../../../components/ui/Modal';
import type { SalePayment, ProductMaster } from '../../../client/types.gen';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { cn } from '../../../lib/utils';

interface SaleDetailProps {
  saleId: string;
}

function PaymentRow({ payment, isMobile }: { payment: SalePayment, isMobile?: boolean }) {
  const { data: xrData } = useQuery({
    ...v1ExchangeRatesRetrieveOptions({
      path: { id: payment.exchange_rate as string }
    }),
    enabled: !!payment.exchange_rate
  });

  const xr = xrData as { bcv_rate: string; parallel_rate: string } | undefined;
  const discount = parseFloat(payment.discount || '0');
  const totalUsd = parseFloat(payment.total_amount_usd) * (1 - discount / 100);
  const totalVes = parseFloat(payment.total_amount_ves) * (1 - discount / 100);

  if (isMobile) {
    return (
      <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm space-y-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900">{payment.payment_method}</p>
              <p className="text-[10px] text-gray-500">{format(new Date(payment.payment_date), "dd/MM/yyyy HH:mm")}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-black text-blue-600">${totalUsd.toFixed(2)}</p>
            <p className="text-[10px] text-gray-400">Bs. {totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
        
        {discount > 0 && (
          <div className="flex justify-between items-center px-3 py-1.5 bg-green-50 rounded-lg">
            <span className="text-[10px] font-bold text-green-700 uppercase">Descuento</span>
            <span className="text-[10px] font-black text-green-700">-{discount}%</span>
          </div>
        )}

        {xr && (
          <div className="flex gap-4 text-[10px] font-medium text-gray-400 border-t pt-2">
            <span>BCV: {parseFloat(xr.bcv_rate).toFixed(2)}</span>
            <span>PAR: {parseFloat(xr.parallel_rate).toFixed(2)}</span>
          </div>
        )}
      </div>
    );
  }

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
        {discount !== 0 ? (
          <div className="flex flex-col items-end">
            <span className="text-blue-500 font-bold">%{discount.toFixed(2)}</span>
            <span className="text-[10px] text-gray-400 font-medium italic">
              -${(parseFloat(payment.total_amount_usd) * (discount / 100)).toFixed(2)}
            </span>
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-right text-gray-600 font-medium">
        Bs. {totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="px-4 py-3 text-right font-bold text-blue-600">
        ${totalUsd.toFixed(2)}
      </td>
    </tr>
  );
}

export default function SaleDetail({ saleId }: SaleDetailProps) {
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { data: products } = useQuery(v1ProductListOptions());

  const { data: sale, isLoading, error } = useQuery(v1SalesRetrieveOptions({
    path: { id: saleId }
  }));

  const { data: payments, isLoading: isLoadingPayments } = useQuery({
    ...v1SalesPaymentsListOptions({
      path: { sale_id: saleId }
    }),
    enabled: showPaymentsModal
  });

  const { rates } = useExchangeRates();

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
        <div className="bg-gray-50 p-4 rounded-2xl space-y-3">
          <div className="flex items-center text-sm text-gray-500">
            <Receipt className="h-4 w-4 mr-2" />
            <span className="font-bold uppercase tracking-widest text-[10px]">Información de Venta</span>
          </div>
          <div>
            <p className="text-lg font-black text-gray-900">Venta #{sale.seq_number}</p>
            <div className="flex items-center text-xs text-gray-500 mt-1 font-medium">
              <Calendar className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
              {format(new Date(sale.created_at), "PPP p", { locale: es })}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-2xl space-y-3">
          <div className="flex items-center text-sm text-gray-500">
            <User className="h-4 w-4 mr-2" />
            <span className="font-bold uppercase tracking-widest text-[10px]">Cliente</span>
          </div>
          <div>
            <p className="text-lg font-black text-gray-900">{sale.customer_name || 'Consumidor Final'}</p>
            <p className="text-xs text-blue-600 font-bold bg-blue-100/50 inline-block px-2 py-0.5 rounded-full mt-1 break-all">ID: {sale.customer || 'Público General'}</p>
          </div>
        </div>
      </div>

      {/* Product List */}
      <div>
        <div className="flex items-center text-sm text-gray-500 mb-3 ml-1">
          <Package className="h-4 w-4 mr-2" />
          <span className="font-bold uppercase tracking-widest text-[10px]">Productos Vendidos</span>
        </div>

        {isMobile ? (
          <div className="space-y-3">
            {sale.sale_details.map((detail) => {
              const product = Array.isArray(products) ? products.find((p: ProductMaster) => p.id === detail.product) : null;
              const hasIVA = product?.IVA;
              const subtotal = parseFloat(detail.quantity) * parseFloat(detail.unit_price || '0');

              return (
                <div key={detail.id} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 mr-4">
                      <h4 className="font-bold text-gray-900 truncate">{detail.product_name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-blue-600">${parseFloat(detail.unit_price || '0').toFixed(2)} c/u</span>
                        {hasIVA && <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold border border-red-100">IVA 16%</span>}
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-gray-100 rounded-lg text-xs font-black text-gray-600">
                      x {detail.quantity}
                    </div>
                  </div>
                  <div className="flex justify-between items-end pt-2 border-t border-gray-50">
                    <div className="text-[10px] text-gray-400 font-medium">
                      {rates && (
                        <span>Bs. {(subtotal * parseFloat(rates.bcv_rate)).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                      )}
                    </div>
                    <p className="text-sm font-black text-gray-900">${subtotal.toFixed(2)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border rounded-lg overflow-x-auto shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Producto</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">Cant.</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">IVA</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">P. Unit (USD)</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">Subtotal (Bs)</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">Subtotal (USD)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sale.sale_details.map((detail) => {
                  const product = Array.isArray(products) ? products.find((p: ProductMaster) => p.id === detail.product) : null;
                  const hasIVA = product?.IVA;
                  const subtotal = parseFloat(detail.quantity) * parseFloat(detail.unit_price || '0');

                  return (
                  <tr key={detail.id} className="text-sm hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-4 text-gray-900 font-semibold">{detail.product_name}</td>
                    <td className="px-4 py-4 text-center text-gray-600 font-medium">{detail.quantity}</td>
                    <td className="px-4 py-4 text-center">
                      {hasIVA ? (
                          <span className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded-full border border-red-100 font-black">16%</span>
                      ) : (
                          <span className="text-[10px] text-gray-400 font-medium">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right text-gray-600 font-semibold">${parseFloat(detail.unit_price || '0').toFixed(2)}</td>
                    <td className="px-4 py-4 text-right text-gray-500 text-xs">
                      {rates ? (
                        `Bs. ${(subtotal * parseFloat(rates.bcv_rate)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      ) : '-'}
                    </td>
                    <td className="px-4 py-4 text-right font-black text-gray-900">
                      ${subtotal.toFixed(2)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Financial Summary */}
      <div className="bg-blue-600 p-6 rounded-3xl relative overflow-hidden shadow-xl shadow-blue-100">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 bg-blue-400/20 rounded-full blur-2xl"></div>
        
        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center text-sm text-blue-100">
              <CreditCard className="h-5 w-5 mr-3" />
              <span className="font-black uppercase tracking-[0.2em] text-[10px]">Resumen de Cuenta</span>
            </div>
            <button
              onClick={() => setShowPaymentsModal(true)}
              className="px-4 py-2 cursor-pointer bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border border-white/20"
            >
              <Search className="h-3.5 w-3.5" />
              Pagos Recibidos
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-blue-100 text-xs font-bold uppercase tracking-widest">Total de Venta</span>
              <div className="text-right">
                <span className="text-3xl font-black text-white block">${parseFloat(sale.total_amount_usd || '0').toFixed(2)}</span>
                {rates && (
                  <span className="text-xs text-blue-100 font-bold opacity-80">
                    ≈ Bs. {(parseFloat(sale.total_amount_usd || '0') * parseFloat(rates.bcv_rate)).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>
            
            <div className="pt-4 border-t border-white/20 flex justify-between items-end">
              <div className="flex flex-col">
                <span className="text-blue-100 text-[10px] font-black uppercase tracking-[0.2em]">Saldo Pendiente</span>
                <span className={cn(
                  "text-xs font-bold mt-1 inline-flex items-center px-2 py-0.5 rounded-full",
                  sale.payment_status === 'PAID' ? "bg-green-400/20 text-green-300" : "bg-red-400/20 text-red-200"
                )}>
                  {sale.payment_status === 'PAID' ? 'Totalmente Pagado' : sale.payment_status === 'PARTIALLY_PAID' ? 'Pago Parcial' : 'Deuda Total'}
                </span>
              </div>
              <div className="text-right">
                <span className={cn(
                  "text-2xl font-black block",
                  sale.payment_status === 'PAID' ? "text-green-300" : "text-red-300"
                )}>
                  ${(parseFloat(sale.total_amount_usd || '0') - parseFloat(sale.total_paid || '0')).toFixed(2)}
                </span>
                {rates && (
                  <span className="text-xs text-red-200 font-bold opacity-80">
                    ≈ Bs. {((parseFloat(sale.total_amount_usd || '0') - parseFloat(sale.total_paid || '0')) * parseFloat(rates.bcv_rate)).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payments Detail Modal */}
      <Modal
        isOpen={showPaymentsModal}
        onClose={() => setShowPaymentsModal(false)}
        title={`Pagos de Venta #${sale.seq_number}`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-6">
          {isLoadingPayments ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-gray-500 text-sm">Validando historial de transacciones...</p>
            </div>
          ) : payments && payments.length > 0 ? (
            <div className="space-y-4">
              {isMobile ? (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <PaymentRow key={payment.id} payment={payment} isMobile={true} />
                  ))}
                </div>
              ) : (
                <div className="overflow-hidden border border-gray-100 rounded-2xl shadow-sm">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Fecha</th>
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Moneda</th>
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Método</th>
                        <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">Desc.</th>
                        <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">Monto (Bs)</th>
                        <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">Monto (USD)</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {payments.map((payment) => (
                        <PaymentRow key={payment.id} payment={payment} />
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50/50">
                      <tr className="text-sm font-black">
                        <td colSpan={3} className="px-4 py-4 text-right text-gray-500 uppercase text-[10px] tracking-widest">Consolidado Pagado</td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] text-gray-400 font-bold uppercase">Total Desc:</span>
                            <span className="text-blue-500">
                              -${payments.reduce((acc, p) => acc + (parseFloat(p.total_amount_usd) * parseFloat(p.discount || '0') / 100), 0).toFixed(2)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right text-gray-700">
                          Bs. {payments.reduce((acc, p) => acc + (parseFloat(p.total_amount_ves) * (1 - parseFloat(p.discount || '0') / 100)), 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-4 text-right text-emerald-600 text-lg">${parseFloat(sale.total_paid).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              
              {isMobile && (
                <div className="bg-emerald-600 p-4 rounded-2xl text-white flex justify-between items-center shadow-lg shadow-emerald-50">
                  <span className="text-xs font-black uppercase tracking-widest">Total Cobrado</span>
                  <span className="text-xl font-black">${parseFloat(sale.total_paid).toFixed(2)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <div className="p-4 bg-gray-100 rounded-full mb-4">
                <Info className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium">No hay registros de pago para esta venta.</p>
            </div>
          )}
          
          <button
            onClick={() => setShowPaymentsModal(false)}
            className="w-full py-4 text-sm font-black text-gray-500 hover:text-gray-700 transition-colors uppercase tracking-widest cursor-pointer"
          >
            Cerrar Ventana
          </button>
        </div>
      </Modal>
    </div>
  );
}


