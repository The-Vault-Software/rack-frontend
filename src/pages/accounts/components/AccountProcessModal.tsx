import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { 
  v1AccountsCreateMutation, 
  v1AccountsPaymentsCreateMutation, 
  v1AccountsListQueryKey, 
} from '../../../client/@tanstack/react-query.gen';
import { zAccountPaymentRequestWritable } from '../../../client/zod.gen';
import type { AccountPaymentRequestWritable, AccountRequestWritable } from '../../../client/types.gen';
import { usePaymentCalculations, type PaymentFormValues } from '../hooks/usePaymentCalculations';
import PaymentFormFields from './PaymentFormFields';
import Modal from '../../../components/ui/Modal';
import ActionConfirmationModal from '../../../components/ui/ActionConfirmationModal';

interface SellingUnit {
  id: string;
  name: string;
  unit_conversion_factor: string;
  measurement_unit: string;
}

interface CartItem {
  product: { id: string; name: string; cost_price_usd?: string };
  quantity: number;
  selectedSellingUnit?: SellingUnit;
}

interface AccountProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  providerId: string;
  branchId: string;
  totalAmount: number; // In USD
  onSuccess: () => void;
}

export default function AccountProcessModal({ 
  isOpen, 
  onClose, 
  cart, 
  providerId, 
  branchId, 
  totalAmount, 
  onSuccess 
}: AccountProcessModalProps) {
  const queryClient = useQueryClient();
  const [isPayLaterConfirmOpen, setIsPayLaterConfirmOpen] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(zAccountPaymentRequestWritable),
    defaultValues: {
      currency: 'VES',
      payment_method: 'PAGO_MOVIL',
      amount: '0.00',
      REF: ''
    }
  });

  const { handleSubmit, formState: { isSubmitting } } = form;
  const calculations = usePaymentCalculations(form, totalAmount);
  
  // Mutations
  const createAccountMutation = useMutation({
    ...v1AccountsCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: v1AccountsListQueryKey() });
    }
  });

  const accountPaymentMutation = useMutation({
    ...v1AccountsPaymentsCreateMutation(),
  });

  const handleRegisterAndPay = async (data: PaymentFormValues) => {
    try {
      // 1. Create Account
      const accountPayload: AccountRequestWritable = {
        branch: branchId,
        provider: providerId,
        details: cart.map((item) => {
          const factor = item.selectedSellingUnit ? parseFloat(item.selectedSellingUnit.unit_conversion_factor) : 1;
          return {
            product: item.product.id,
            quantity: item.quantity * factor
          };
        })
      };

      const account = await createAccountMutation.mutateAsync({ body: accountPayload });
      
      // 2. Register Payment
      const paymentPayload: AccountPaymentRequestWritable = {
        amount: data.amount,
        currency: data.currency,
        payment_method: data.payment_method,
        REF: data.REF,
      };

      await accountPaymentMutation.mutateAsync({
        path: { account_id: account.id },
        body: paymentPayload
      });

      toast.success('Compra y pago registrados exitosamente');
      onSuccess();
    } catch (error) {
      console.error(error);
      toast.error('Error al procesar la compra y el pago');
    }
  };

  const handlePayLater = async () => {
    try {
      const accountPayload: AccountRequestWritable = {
        branch: branchId,
        provider: providerId,
        details: cart.map((item) => {
          const factor = item.selectedSellingUnit ? parseFloat(item.selectedSellingUnit.unit_conversion_factor) : 1;
          return {
            product: item.product.id,
            quantity: item.quantity * factor
          };
        })
      };

      await createAccountMutation.mutateAsync({ body: accountPayload });
      toast.success('Compra registrada como cuenta por pagar');
      setIsPayLaterConfirmOpen(false);
      onSuccess();
    } catch (error) {
      console.error(error);
      toast.error('Error al registrar la compra');
    }
  };

  const handleAttemptClose = () => {
    setIsCancelConfirmOpen(true);
  };

  const handleCancelConfirm = () => {
    setIsCancelConfirmOpen(false);
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleAttemptClose}
        title="Finalizar Compra"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-6">
          <PaymentFormFields 
            form={form} 
            type="account" 
            pendingAmount={totalAmount} 
            calculations={calculations}
          />

          <div className="grid grid-cols-2 gap-3 pt-4 border-t">
            {/* Pay Later - Left */}
            <button
              type="button"
              onClick={() => setIsPayLaterConfirmOpen(true)}
              disabled={isSubmitting || createAccountMutation.isPending}
              className="px-4 py-3 border-2 border-orange-100 bg-orange-50 text-orange-700 rounded-xl text-sm font-bold hover:bg-orange-100 transition-colors flex items-center justify-center gap-2"
            >
              <AlertCircle className="h-4 w-4" />
              Pagar Después (Deuda)
            </button>

            {/* Register and Pay - Right */}
            <button
              type="button"
              onClick={handleSubmit(handleRegisterAndPay)}
              disabled={isSubmitting || createAccountMutation.isPending || accountPaymentMutation.isPending}
              className="px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {(isSubmitting || createAccountMutation.isPending || accountPaymentMutation.isPending) ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                >
                  <RefreshCw className="h-4 w-4" />
                </motion.div>
              ) : 'Registrar y Pagar'}
            </button>

            {/* Cancel - Bottom, Full Width */}
            <button
              type="button"
              onClick={handleAttemptClose}
              className="col-span-2 px-4 py-3 text-gray-400 hover:text-gray-600 font-medium text-sm hover:bg-gray-50 rounded-lg transition-colors"
            >
              Cancelar y Volver al Carrito
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation for Pay Later */}
      <ActionConfirmationModal
        isOpen={isPayLaterConfirmOpen}
        onClose={() => setIsPayLaterConfirmOpen(false)}
        onConfirm={handlePayLater}
        title="¿Registrar Compra por Pagar?"
        description="La compra se registrará sin pago asociado y quedará como cuenta por pagar (deuda). ¿Desea continuar?"
        confirmText="Sí, Registrar Deuda"
        cancelText="Volver"
        variant="warning"
      />

       {/* Confirmation for Cancel */}
       <ActionConfirmationModal
        isOpen={isCancelConfirmOpen}
        onClose={() => setIsCancelConfirmOpen(false)}
        onConfirm={handleCancelConfirm}
        title="¿Cancelar Compra?"
        description="Si sales ahora, la compra no se guardará y volverás al carrito. ¿Estás seguro?"
        confirmText="Sí, Cancelar"
        cancelText="Continuar con la Compra"
        variant="danger"
      />
    </>
  );
}
