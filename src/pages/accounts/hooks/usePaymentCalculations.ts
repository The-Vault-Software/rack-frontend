import { useState, useEffect, useMemo } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { v1ExchangeRatesTodayRetrieveOptions } from '../../../client/@tanstack/react-query.gen';

export type PaymentFormValues = {
  currency: string;
  payment_method: string;
  amount: string;
  REF?: string | null;
  discount?: string;
};

export function usePaymentCalculations(
  form: UseFormReturn<PaymentFormValues>,
  pendingAmount: number
) {
  const { control, setValue } = form;

  const { data: ratesData } = useQuery({
    ...v1ExchangeRatesTodayRetrieveOptions(),
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  const rates = ratesData as { bcv_rate: string; parallel_rate: string } | undefined;
  
  // 'auto': aplica la fórmula, 'manual': usuario editó, 'off': sin ajuste
  const [adjustmentType, setAdjustmentType] = useState<'auto' | 'manual' | 'off'>('off');

  const currency = useWatch({ control, name: 'currency' });
  const amount = useWatch({ control, name: 'amount' });
  const discount = useWatch({ control, name: 'discount' });

  // Cálculo de valores iniciales y sugeridos
  useEffect(() => {
    if (rates) {
      const bcv_rate = parseFloat(rates.bcv_rate);
      if (currency === 'VES') {
        const suggestedVES = pendingAmount * bcv_rate;
        setValue('amount', suggestedVES.toFixed(2));
      } else if (currency === 'USD') {
        if (adjustmentType === 'auto') {
          const parallel_rate = parseFloat(rates.parallel_rate);
          const netAmount = (pendingAmount * bcv_rate) / parallel_rate;
          const factor = ((parallel_rate / bcv_rate) - 1) * 100;
          setValue('amount', netAmount.toFixed(2));
          setValue('discount', factor.toFixed(2));
        } else if (adjustmentType === 'off') {
          setValue('amount', pendingAmount.toFixed(2));
          setValue('discount', '0.00');
        }
      }
    }
  }, [rates, currency, pendingAmount, setValue, adjustmentType]);

  // Manejar cambio manual de monto
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue('amount', val);
    
    if (currency === 'USD' && adjustmentType !== 'off') {
      setAdjustmentType('manual');
      // Recalcular descuento según el nuevo monto
      // Si el usuario paga X, y debía pagar pendingAmount...
      // factor = (1 - (X / pendingAmount)) * 100
        const newAmount = parseFloat(val || '0');
        if (newAmount > 0) {
          const newFactor = ((pendingAmount / newAmount) - 1) * 100;
          setValue('discount', Math.max(0, newFactor).toFixed(2));
        } else {
          setValue('discount', '0.00');
        }
    }
  };

  const suggestedAmount = useMemo(() => {
    if (!rates) return 0;
    const bcv_rate = parseFloat(rates.bcv_rate);
    const parallel_rate = parseFloat(rates.parallel_rate);
    if (currency === 'VES') return pendingAmount * bcv_rate;
    if (adjustmentType === 'auto') return (pendingAmount * bcv_rate) / parallel_rate;
    return pendingAmount;
  }, [rates, currency, pendingAmount, adjustmentType]);

  return {
    rates,
    adjustmentType,
    setAdjustmentType,
    handleAmountChange,
    suggestedAmount,
    currency,
    amount,
    discount
  };
}
