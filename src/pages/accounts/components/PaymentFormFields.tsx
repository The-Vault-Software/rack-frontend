import type { UseFormReturn } from 'react-hook-form';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import Tooltip from '../../../components/ui/Tooltip';
import type { PaymentFormValues } from '../hooks/usePaymentCalculations';

interface PaymentFormFieldsProps {
  form: UseFormReturn<PaymentFormValues>;
  type: 'account' | 'sale';
  pendingAmount: number;
  calculations: {
    rates: { bcv_rate: string; parallel_rate: string } | undefined;
    adjustmentType: 'auto' | 'manual' | 'off';
    setAdjustmentType: React.Dispatch<React.SetStateAction<'auto' | 'manual' | 'off'>>;
    handleAmountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    suggestedAmount: number;
    currency: string;
    amount: string;
    discount?: string;
  };
}

export default function PaymentFormFields({ 
  form, 
  type, 
  pendingAmount, 
  calculations 
}: PaymentFormFieldsProps) {
  const { register } = form;
  const { 
    rates, 
    adjustmentType, 
    setAdjustmentType, 
    handleAmountChange, 
    suggestedAmount, 
    currency, 
    amount, 
    discount 
  } = calculations;

  return (
    <div className="space-y-6">
      {/* Selector de Moneda y Método */}
      <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Moneda</label>
          <select
            {...register('currency', {
              onChange: (e) => {
                if (e.target.value === 'VES') {
                  setAdjustmentType('off');
                }
              }
            })}
            className="block w-full rounded-lg border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border py-2.5 px-3 bg-white transition-all cursor-pointer"
          >
            <option value="VES">Bolívares (VES)</option>
            <option value="USD">Dólares (USD)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Método de Pago</label>
          <select
            {...register('payment_method')}
            className="block w-full rounded-lg border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border py-2.5 px-3 bg-white transition-all cursor-pointer"
          >
            <option value="PAGO_MOVIL">Pago Móvil</option>
            <option value="CASH">Efectivo</option>
            <option value="TRANSFER">Transferencia</option>
            <option value="DEBIT">Tarjeta Débito</option>
            <option value="ZELLE">Zelle</option>
          </select>
        </div>
      </div>

      {/* Toggle de Ajuste por Divisas */}
      <AnimatePresence>
        {currency === 'USD' && (
          <motion.div 
            initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
            animate={{ 
              opacity: 1, 
              height: 'auto',
              transitionEnd: { overflow: 'visible' }
            }}
            exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
          >
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-blue-900">Ajuste por Divisas</span>
                <Tooltip 
                  icon 
                  content="Este ajuste compensa la diferencia entre la tasa oficial (BCV) y la tasa de mercado aplicada. Permite saldar el compromiso en Bolívares cobrando un monto menor en divisas, manteniendo el valor real de la transacción" 
                />
              </div>
              <button
                type="button"
                onClick={() => setAdjustmentType(prev => prev === 'off' ? 'auto' : 'off')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ring-2 ring-offset-2 cursor-pointer ${adjustmentType !== 'off' ? 'bg-blue-600 ring-blue-500' : 'bg-gray-200 ring-transparent'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${adjustmentType !== 'off' ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Monto principal */}
      <div className="space-y-3">
        <label className="block text-sm font-bold text-gray-700">
          Monto a {type === 'account' ? 'Pagar' : 'Cobrar'}
        </label>
        
        <div className="relative group">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <span className="text-gray-400 font-medium">{currency === 'USD' ? '$' : 'Bs.'}</span>
          </div>
          <input
            {...register('amount')}
            onChange={handleAmountChange}
            type="number"
            step="0.01"
            className={`block w-full rounded-xl border-gray-200 pl-12 pr-12 py-4 text-2xl font-bold transition-all focus:ring-4 focus:ring-blue-500/10 ${adjustmentType === 'manual' ? 'border-orange-300 bg-orange-50/30' : 'focus:border-blue-500'}`}
            placeholder="0.00"
          />
          {adjustmentType === 'manual' && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <button 
                type="button"
                onClick={() => setAdjustmentType('auto')}
                className="p-1 hover:bg-orange-100 rounded-full text-orange-600 transition-colors cursor-pointer"
                title="Restablecer monto sugerido"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        {/* Comparativa Visual y Tasas */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500 font-medium">Saldo Pendiente:</span>
            <span className="text-gray-900 font-bold">${pendingAmount.toFixed(2)} o Bs.{(pendingAmount * parseFloat(rates?.bcv_rate || '0')).toFixed(2)} </span>
          </div>

          <AnimatePresence mode="wait">
            {adjustmentType !== 'off' && currency === 'USD' && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex justify-between items-center text-sm p-2 bg-green-50 rounded-lg border border-green-100"
              >
                <div className="flex items-center gap-1.5 text-green-700 font-semibold">
                  <span className="text-xs uppercase">Ajuste Aplicado:</span>
                  <span>{discount}%</span>
                </div>
                <div className="text-green-600 text-xs font-medium italic">
                  Sugerido: ${suggestedAmount.toFixed(2)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {rates && (
            <div className="pt-2 border-t border-gray-50 flex justify-between items-center">
              <div className="flex gap-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <span>BCV: {rates.bcv_rate}</span>
                <span>P: {rates.parallel_rate}</span>
              </div>
              {currency === 'USD' && (
                <div className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  ≈ Bs. {(parseFloat(amount || '0') * parseFloat(rates.parallel_rate)).toLocaleString('es-VE')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {type === 'account' ? (
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Referencia (Opcional)</label>
          <input
            {...register('REF')}
            type="text"
            className="block w-full rounded-lg border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border py-2.5 px-3 transition-all"
            placeholder="Número de transferencia, etc."
          />
        </div>
      ) : null}
    </div>
  );
}
