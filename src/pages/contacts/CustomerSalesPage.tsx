import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import SalesHistory from '../sales/components/SalesHistory';
import { ArrowLeft, User, MessageCircle, Loader2, PhoneOff, CheckCircle2, DollarSign } from 'lucide-react';
import { v1SalesRetrieve } from '../../client/sdk.gen';
import { motion, AnimatePresence } from 'framer-motion';
import type { SaleList, Sale } from '../../client/types.gen';
import { useState } from 'react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import { v1CustomersRetrieveOptions, v1SalesListOptions, v1SalesPaymentsCreateMutation } from '../../client/@tanstack/react-query.gen';
import PaymentForm from '../../pages/accounts/components/PaymentForm';
import { type PaymentFormValues } from '../../pages/accounts/hooks/usePaymentCalculations';
import Modal from '../../components/ui/Modal';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useExchangeRates } from '../../hooks/useExchangeRates';

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
  const queryClient = useQueryClient();
  const { rates } = useExchangeRates();

  const saleMutation = useMutation({
    ...v1SalesPaymentsCreateMutation(),
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
    if (!rates) return;

    const bcv_rate = parseFloat(rates.bcv_rate);
    const conversionRate = data.currency === 'VES' ? bcv_rate : 1;
    let remainingAmount = parseFloat(data.amount);

    // Sort pending sales by date (oldest first)
    const sortedSales = [...pendingSales].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    let paymentCount = 0;

    for (const sale of sortedSales) {
      if (remainingAmount <= 0.01) break; // Use a small epsilon for float comparison logic

      const totalUSD = parseFloat(sale.total_amount_usd);
      const paidUSD = parseFloat(sale.total_paid);
      const pendingUSD = totalUSD - paidUSD;
      
      const pendingInCurrency = pendingUSD * conversionRate;
      const paymentForThisSale = Math.min(remainingAmount, pendingInCurrency);

      if (paymentForThisSale > 0) {
        // Prepare payload - discount is applied equally if present
        const finalDiscount = (data.currency === 'USD' && data.discount) ? data.discount : '0.00';
        
        await saleMutation.mutateAsync({
           path: { sale_id: sale.id },
           body: {
             amount: paymentForThisSale.toFixed(2),
             currency: data.currency,
             payment_method: data.payment_method,
             discount: finalDiscount
           }
        });

        remainingAmount -= paymentForThisSale;
        paymentCount++;
      }
    }

    if (paymentCount > 0) {
      toast.success(`Se registraron ${paymentCount} pagos exitosamente.`);
      setIsPaymentModalOpen(false);
      queryClient.invalidateQueries({ queryKey: [{ _id: 'v1SalesList' }] });
    } else {
      toast.info("No se realizó ningún pago (monto insuficiente o sin deuda).");
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
      
      const cleanPhone = customer.phone.replace(/\D/g, '');
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
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
