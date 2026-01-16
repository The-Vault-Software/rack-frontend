import { useForm, useWatch } from 'react-hook-form';
import { useMemo, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  accountsPaymentsCreateMutation, 
  salesPaymentsCreateMutation, 
  accountsListQueryKey, 
  salesListQueryKey,
  exchangeRatesTodayRetrieveOptions
} from '../../../client/@tanstack/react-query.gen';
import { zAccountPaymentRequestWritable, zSalePaymentRequestWritable } from '../../../client/zod.gen';
import type { AccountPaymentRequestWritable, SalePaymentRequestWritable } from '../../../client/types.gen';

interface PaymentFormProps {
  type: 'account' | 'sale';
  id: string;
  onSuccess: () => void;
  pendingAmount: number;
}

type PaymentFormValues = {
  currency: string;
  payment_method: string;
  amount: string;
  REF?: string | null;
  discount?: string;
};

export default function PaymentForm({ type, id, onSuccess, pendingAmount }: PaymentFormProps) {
  const queryClient = useQueryClient();
  const schema = type === 'account' ? zAccountPaymentRequestWritable : zSalePaymentRequestWritable;

  const { data: ratesData } = useQuery({
    ...exchangeRatesTodayRetrieveOptions(),
    staleTime: 1000 * 60 * 30,
  });

  const rates = ratesData as { bcv_rate?: string; parallel_rate?: string; bcv?: string; parallel?: string } | undefined;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currency: 'VES',
      payment_method: 'PAGO_MOVIL',
      amount: '0.00',
      ...(type === 'account' ? { REF: '' } : { discount: '0.00' })
    }
  });

  const currency = useWatch({ control, name: 'currency' });
  const amount = useWatch({ control, name: 'amount' });

  useEffect(() => {
    if (rates && (rates.bcv_rate || rates.bcv)) {
      const rate = parseFloat(rates.bcv_rate || rates.bcv || '0');
      const vesAmount = pendingAmount * rate;
      setValue('amount', vesAmount.toFixed(2));
    }
  }, [rates, pendingAmount, setValue]);

  const previewAmount = useMemo(() => {
    if (!rates || !amount) return 0;
    const rate = parseFloat(rates.bcv_rate || rates.bcv || rates.parallel_rate || rates.parallel || '0');
    if (rate === 0) return 0;
    
    if (currency === 'USD') {
      return parseFloat(amount) * rate;
    } else {
      return parseFloat(amount) / rate;
    }
  }, [rates, amount, currency]);

  const accountMutation = useMutation({
    ...accountsPaymentsCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountsListQueryKey() });
      toast.success('Pago registrado correctamente');
      onSuccess();
    },
    onError: () => toast.error('Error al registrar el pago')
  });

  const saleMutation = useMutation({
    ...salesPaymentsCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesListQueryKey() });
      toast.success('Cobro registrado correctamente');
      onSuccess();
    },
    onError: () => toast.error('Error al registrar el cobro')
  });

  const onSubmit = (data: PaymentFormValues) => {
    if (type === 'account') {
      const body: AccountPaymentRequestWritable = {
        amount: data.amount,
        currency: data.currency,
        payment_method: data.payment_method,
        REF: data.REF
      };
      accountMutation.mutate({
        path: { account_id: id },
        body
      });
    } else {
      const body: SalePaymentRequestWritable = {
        amount: data.amount,
        currency: data.currency,
        payment_method: data.payment_method,
        discount: data.discount || '0.00'
      };
      saleMutation.mutate({
        path: { sale_id: id },
        body
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">
          Monto a {type === 'account' ? 'Pagar' : 'Cobrar'} ({currency})
        </label>
        <div className="relative mt-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <span className="text-gray-500 sm:text-sm">{currency === 'USD' ? '$' : 'Bs.'}</span>
          </div>
          <input
            {...register('amount')}
            type="number"
            step="0.01"
            className="block w-full rounded-md border-gray-300 pl-10 pr-12 focus:border-blue-500 focus:ring-blue-500 sm:text-sm border py-2"
            placeholder="0.00"
          />
        </div>
        {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>}
        <div className="mt-1 flex justify-between items-center text-xs">
          <p className="text-gray-500 font-medium">Saldo pendiente: ${pendingAmount.toFixed(2)}</p>
          {rates && (
            <p className="text-blue-600 font-bold">
              ≈ {currency === 'USD' ? 'Bs.' : '$'} {previewAmount.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {currency === 'USD' ? '(BCV)' : ''}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Moneda</label>
          <select
            {...register('currency')}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border py-2 px-3 bg-white"
          >
            <option value="USD">Dólares (USD)</option>
            <option value="VES">Bolívares (VES)</option>
          </select>
          {errors.currency && <p className="mt-1 text-sm text-red-600">{errors.currency.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Método</label>
          <select
            {...register('payment_method')}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border py-2 px-3 bg-white"
          >
            <option value="CASH">Efectivo</option>
            <option value="TRANSFER">Transferencia</option>
            <option value="DEBIT">Tarjeta Débito</option>
            <option value="ZELLE">Zelle</option>
            <option value="PAGO_MOVIL">Pago Móvil</option>
          </select>
          {errors.payment_method && <p className="mt-1 text-sm text-red-600">{errors.payment_method.message}</p>}
        </div>
      </div>

      {type === 'account' ? (
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Referencia (Opcional)</label>
          <input
            {...register('REF')}
            type="text"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border py-2 px-3"
            placeholder="Número de transferencia, etc."
          />
          {errors.REF && <p className="mt-1 text-sm text-red-600">{errors.REF.message}</p>}
        </div>
      ) : (
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Descuento</label>
          <input
            {...register('discount')}
            type="number"
            step="0.01"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border py-2 px-3"
            placeholder="0.00"
          />
          {errors.discount && <p className="mt-1 text-sm text-red-600">{errors.discount.message}</p>}
        </div>
      )}

      <div className="pt-4 flex justify-end space-x-3">
        <button
          type="button"
          onClick={onSuccess}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isSubmitting ? 'Registrando...' : `Registrar ${type === 'account' ? 'Pago' : 'Cobro'}`}
        </button>
      </div>
    </form>
  );
}
