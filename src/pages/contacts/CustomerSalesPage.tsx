import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import SalesHistory from '../sales/components/SalesHistory';
import { ArrowLeft, User, MessageCircle, Loader2, PhoneOff, CheckCircle2, DollarSign, Undo2 } from 'lucide-react';
import { v1SalesRetrieve } from '../../client/sdk.gen';
import { motion, AnimatePresence } from 'framer-motion';
import type { SaleList, Sale } from '../../client/types.gen';
import { useState } from 'react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import { toWhatsAppNumber } from '../../lib/phone';
import {
  v1CustomersRetrieveOptions,
  v1CustomersRetrieveQueryKey,
  v1CustomerPaymentsCreateMutation,
  v1SalesListOptions,
  v1SalesPaymentsListQueryKey,
  v1SalesRetrieveQueryKey,
} from '../../client/@tanstack/react-query.gen';
import PaymentForm from '../../pages/accounts/components/PaymentForm';
import { type PaymentFormValues } from '../../pages/accounts/hooks/usePaymentCalculations';
import Modal from '../../components/ui/Modal';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useBranch } from '../../context/BranchContext';
import { extractErrorDetail } from './hooks/useReversePayments';
import ReversePaymentsModal from './components/ReversePaymentsModal';

export default function CustomerSalesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: customer, isLoading } = useQuery({
    ...v1CustomersRetrieveOptions({
        path: { id: id! }
    }),
    enabled: !!id
  });

  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const { selectedBranch } = useBranch();

  // One atomic bulk registration call replacing the legacy per-sale loop.
  // Allocation is delegated to the backend (POST /v1/customer-payments/),
  // so the cashier sees exactly one success toast and no partial-success UI.
  const customerPaymentMutation = useMutation({
    ...v1CustomerPaymentsCreateMutation(),
  });

  const { data: salesData, isLoading: isLoadingSales } = useQuery({
    ...v1SalesListOptions({
      query: { 
        // @ts-expect-error - customer_id is supported
        customer_id: id,
        page_size: 100 
      }
    }),
    enabled: !!id
  });

  const pendingSales = (salesData?.results as SaleList[] || []).filter(s => s.payment_status !== 'PAID');
  const pendingSalesCount = pendingSales.length;

  const totalDebt = pendingSales.reduce((acc, sale) => {
    const total = parseFloat(sale.total_amount_usd || '0');
    const paid = parseFloat(sale.total_paid || '0');
    return acc + (total - paid);
  }, 0);

  const handleBulkPayment = async (data: PaymentFormValues) => {
    // The bulk endpoint scopes the cobro to one customer + one branch, then
    // allocates the amount oldest-first across that customer's pending sales
    // server-side. Allocation data (bcv rate, per-sale conversion, sort) is
    // no longer computed by the client — the backend owns the snapshot.
    if (!id || !selectedBranch?.id) return;

    // USD-only discount guard (legacy frontend quirk): the discount is applied
    // only when the payment currency is USD. This intentionally does NOT
    // align with the backend's uniform SalePaymentSerializer semantics; the
    // backend still receives discount in either currency and stores it as-is.
    const finalDiscount = (data.currency === 'USD' && data.discount) ? data.discount : '0.00';

    try {
      const result = await customerPaymentMutation.mutateAsync({
        body: {
          customer_id: id,
          branch: selectedBranch.id,
          amount: data.amount,
          currency: data.currency,
          payment_method: data.payment_method,
          discount: finalDiscount,
          // sale_ids intentionally omitted (Option B): selective-sale payment
          // can be added later without a contract break.
        },
      });

      // Exactly one success toast. Atomic backend registration means there
      // are no partial-success states to surface.
      toast.success('Se registró el pago exitosamente.');
      setIsPaymentModalOpen(false);

      // Invalidate the sale aggregates plus the per-sale keys touched by the
      // bulk call (reported via affected_sales) and the customer retrieve so
      // any customer-derived debt refreshes. Mirrors useReversePayments.
      queryClient.invalidateQueries({ queryKey: [{ _id: 'v1SalesList' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'v1CustomerSalePaymentsList' }] });
      result.affected_sales.forEach(({ sale_id }) => {
        queryClient.invalidateQueries({
          queryKey: v1SalesRetrieveQueryKey({ path: { id: sale_id } }),
        });
        queryClient.invalidateQueries({
          queryKey: v1SalesPaymentsListQueryKey({ path: { sale_id } }),
        });
      });
      queryClient.invalidateQueries({
        queryKey: v1CustomersRetrieveQueryKey({ path: { id } }),
      });
    } catch (error) {
      // Surface the backend `detail` message; keep the payment modal open with
      // the entered values (react-hook-form preserves them) so the cashier
      // can adjust and retry without re-typing.
      toast.error(extractErrorDetail(error) ?? 'Error al registrar el pago');
    }
  };



  const handleSendWhatsAppSummary = async () => {
    if (!customer || !id) return;
    
    setIsGeneratingSummary(true);
    try {
      const pendingSales = (salesData?.results as SaleList[] || []).filter(s => s.payment_status !== 'PAID');
      
      if (pendingSales.length === 0) {
        alert('Este cliente no tiene cuentas pendientes por pagar.');
        return;
      }
      
      // 2. Fetch full details for each pending sale to get products
      const salesWithDetails = await Promise.all(
        pendingSales.map(async (s) => {
          const { data } = await v1SalesRetrieve({ path: { id: s.id } });
          return data as Sale;
        })
      );
      
      const validSales = salesWithDetails.filter((s): s is Sale => !!s);
      
      // 3. Format Message
      let message = `*Resumen de Cuentas Pendientes*\n`;
      message += `*Cliente:* ${customer.name}\n`;
      message += `*Fecha:* ${format(new Date(), "dd/MM/yyyy")}\n`;
      message += `--------------------------------\n\n`;
      
      let totalPendingBalance = 0;
      
      validSales.forEach((sale) => {
        const total = parseFloat(sale.total_amount_usd || '0');
        const paid = parseFloat(sale.total_paid || '0');
        const pending = total - paid;
        totalPendingBalance += pending;
        
        message += `*Venta del ${format(new Date(sale.created_at), "dd/MM/yyyy")}*\n`;
        
        sale.sale_details.forEach((detail) => {
          message += `• ${parseFloat(detail.quantity)} x ${detail.product_name} ($${parseFloat(detail.unit_price).toFixed(2)})\n`;
        });
        
        message += `*Subtotal:* $${total.toFixed(2)}\n`;
        if (paid > 0) message += `*Pagado:* $${paid.toFixed(2)}\n`;
        message += `*Pendiente:* $${pending.toFixed(2)}\n`;
        message += `\n`;
      });
      
      message += `--------------------------------\n`;
      message += `*TOTAL A PAGAR AL DÍA DE HOY:* $${totalPendingBalance.toFixed(2)}\n\n`;
      message += `_Este es un resumen automático. Si tienes alguna duda, por favor contáctanos._`;
      
      // 4. Open WhatsApp
      if (!customer.phone) {
        alert('Este cliente no tiene un número de teléfono registrado.');
        return;
      }

      // Records created before phone normalization may hold any format.
      const whatsappNumber = toWhatsAppNumber(customer.phone);
      if (!whatsappNumber) {
        alert(
          'El número de teléfono de este cliente no tiene un formato válido. ' +
          'Edítalo e ingrésalo como +58 412-1234567, 0412-1234567 o 412-1234567.'
        );
        return;
      }

      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      
    } catch (error) {
      console.error('Error generating WhatsApp summary:', error);
      alert('Hubo un error al generar el resumen. Por favor intenta de nuevo.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  if (!id) return <div>ID de cliente no proporcionado</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/contacts')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="h-6 w-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <User className="h-6 w-6 text-blue-500" />
              Historial de Ventas
            </h1>
            {isLoading ? (
              <div className="h-5 w-48 bg-gray-200 animate-pulse rounded mt-1"></div>
            ) : (
              <p className="text-gray-500">
                Cliente: <span className="font-semibold text-gray-900">{customer?.name}</span>
              </p>
            )}
          </div>
        </div>

        <AnimatePresence>
          {customer && (
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                 <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  disabled={pendingSalesCount === 0}
                  onClick={() => setIsPaymentModalOpen(true)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-white rounded-lg shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                    pendingSalesCount === 0
                      ? "bg-gray-400 shadow-gray-200" 
                      : "bg-blue-600 hover:bg-blue-700 shadow-blue-200"
                  )}
                >
                  <DollarSign className="h-5 w-5" />
                  <span className="font-semibold text-sm">Registrar Pago</span>
                </motion.button>

                <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => setIsReverseModalOpen(true)}
                  aria-label="Devolver un pago registrado de este cliente"
                  title="Devolver un pago registrado de este cliente"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 bg-white text-red-700 shadow-sm transition-all active:scale-95 hover:bg-red-50"
                >
                  <Undo2 className="h-5 w-5" />
                  <span className="font-semibold text-sm">Devolver Pago</span>
                </motion.button>

                <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  disabled={isGeneratingSummary || !customer.phone || pendingSalesCount === 0}
                  onClick={handleSendWhatsAppSummary}
                  title={
                    !customer.phone 
                      ? "Este cliente no tiene un número de teléfono registrado. Por favor actualízalo en la sección de contactos." 
                      : pendingSalesCount === 0
                      ? "El cliente no tiene cuentas pendientes."
                      : "Enviar resumen de deuda por WhatsApp"
                  }
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-white rounded-lg shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                    (!customer.phone || pendingSalesCount === 0)
                      ? "bg-gray-400 shadow-gray-200" 
                      : "bg-green-500 hover:bg-green-600 shadow-green-200",
                    isGeneratingSummary && "animate-pulse"
                  )}
                >
                  {isGeneratingSummary || isLoadingSales ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : !customer.phone ? (
                    <PhoneOff className="h-5 w-5" />
                  ) : (
                    <MessageCircle className="h-5 w-5" />
                  )}
                  <span className="font-semibold text-sm">
                    {isGeneratingSummary || isLoadingSales
                      ? 'Procesando...' 
                      : !customer.phone 
                      ? 'Sin teléfono' 
                      : 'WhatsApp'}
                  </span>
                </motion.button>
              </div>
              
              {!isLoadingSales && pendingSalesCount === 0 && (
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-emerald-600 font-medium flex items-center gap-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  El cliente no debe nada al día de hoy.
                </motion.p>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>

       <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={`Registrar Pago Global - ${customer?.name}`}
      >
        <PaymentForm
          type="sale"
          id={id || ''} // Dummy ID, logic is handled by onSubmitOverride
          pendingAmount={totalDebt}
          onSuccess={() => {
             // onSuccess is triggered manually inside handleBulkPayment or if we used the default mutation
          }}
          onSubmitOverride={handleBulkPayment}
        />
      </Modal>

      <ReversePaymentsModal
        isOpen={isReverseModalOpen}
        onClose={() => setIsReverseModalOpen(false)}
        customerId={id!}
        customerName={customer?.name}
      />

      {/* Debt Summary Card */}
      {!isLoadingSales && (
         <motion.div 
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-sm"
         >
           <div className="flex items-center justify-between mb-2">
             <h3 className="text-gray-500 font-medium text-sm uppercase tracking-wide">Deuda Total Pendiente</h3>
             <div className={cn("p-2 rounded-lg", 
               totalDebt > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
             )}>
                <DollarSign className="h-5 w-5" /> 
             </div>
           </div>
           
           <div className="flex items-baseline gap-1">
             <span className={cn("text-3xl font-bold", 
               totalDebt > 0 ? "text-gray-900" : "text-emerald-600"
             )}>
               ${totalDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
             </span>
             <span className="text-gray-500 text-sm font-medium">USD</span>
           </div>
           
           {totalDebt > 0 ? (
             <p className="text-xs text-red-500 mt-2 font-medium flex items-center gap-1">
               Requiere pago
             </p>
           ) : (
             <p className="text-xs text-emerald-600 mt-2 font-medium">
               Al día
             </p>
           )}
         </motion.div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <SalesHistory customerId={id} />
      </div>
    </div>
  );
}
