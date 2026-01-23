import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { 
  v1AccountsPaymentsCreateMutation, 
  v1SalesPaymentsCreateMutation, 
  v1AccountsListQueryKey, 
  v1SalesListQueryKey,
} from '../../../client/@tanstack/react-query.gen';
import { zAccountPaymentRequestWritable, zSalePaymentRequestWritable } from '../../../client/zod.gen';
import type { AccountPaymentRequestWritable, SalePaymentRequestWritable } from '../../../client/types.gen';
import { usePaymentCalculations, type PaymentFormValues } from '../hooks/usePaymentCalculations';
import PaymentFormFields from './PaymentFormFields';

interface PaymentFormProps {
  type: 'account' | 'sale';
  id: string;
  onSuccess: () => void;
  pendingAmount: number; // Siempre viene en USD desde el backend
}

export default function PaymentForm({ type, id, onSuccess, pendingAmount }: PaymentFormProps) {
  const queryClient = useQueryClient();
  const schema = type === 'account' ? zAccountPaymentRequestWritable : zSalePaymentRequestWritable;

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currency: 'VES',
      payment_method: 'PAGO_MOVIL',
      amount: '0.00',
      ...(type === 'account' ? { REF: '' } : { discount: '0.00' })
    }
  });

  const { handleSubmit, formState: { isSubmitting } } = form;

  const calculations = usePaymentCalculations(form, pendingAmount);
  const { currency, adjustmentType } = calculations;

  const accountMutation = useMutation({
    ...v1AccountsPaymentsCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: v1AccountsListQueryKey() });
      toast.success('Pago registrado correctamente');
      onSuccess();
    },
    onError: () => toast.error('Error al registrar el pago')
  });

  const saleMutation = useMutation({
    ...v1SalesPaymentsCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: v1SalesListQueryKey() });
      toast.success('Cobro registrado correctamente');
      onSuccess();
    },
    onError: () => toast.error('Error al registrar el cobro')
  });

  const onSubmit = async (data: PaymentFormValues) => {
    // Asegurarse de enviar el descuento si es USD y está activo
    const finalDiscount = (currency === 'USD' && adjustmentType !== 'off') ? data.discount : '0.00';

    if (type === 'account') {
      const body: AccountPaymentRequestWritable = {
        amount: data.amount,
        currency: data.currency,
        payment_method: data.payment_method,
        REF: data.REF,
      };
      return accountMutation.mutateAsync({
        path: { account_id: id },
        body
      });
    } else {
      const body: SalePaymentRequestWritable = {
        amount: data.amount,
        currency: data.currency,
        payment_method: data.payment_method,
        discount: finalDiscount || '0.00'
      };
      return saleMutation.mutateAsync({
        path: { sale_id: id },
        body
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <PaymentFormFields 
        form={form} 
        type={type} 
        pendingAmount={pendingAmount} 
        calculations={calculations}
      />

      {/* Botones de acción */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onSuccess}
          className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting || accountMutation.isPending || saleMutation.isPending}
          className="flex-2 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {isSubmitting || accountMutation.isPending || saleMutation.isPending ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            >
              <RefreshCw className="h-4 w-4" />
            </motion.div>
          ) : `Registrar ${type === 'account' ? 'Pago' : 'Cobro'}`}
        </button>
      </div>
    </form>
  );
}
