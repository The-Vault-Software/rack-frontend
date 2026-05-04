import { useMemo } from 'react';
import {
  useForm, useFieldArray, useWatch,
  type Control, type UseFormRegister, type FieldErrors, type UseFormSetValue,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  v1AdjustmentsCreateMutation,
  v1ProductListOptions,
  v1ProductRetrieveOptions,
  v1ProductBranchStockListOptions,
  v1MeasurementListOptions,
} from '../../../client/@tanstack/react-query.gen';
import { useBranch } from '../../../context/BranchContext';
import { toast } from 'sonner';
import { Plus, Trash2, AlertCircle, Layers } from 'lucide-react';
import type { ProductMaster, ProductStockSale, MeasurementUnit } from '../../../client/types.gen';
import { cn } from '../../../lib/utils';

const ADJUSTMENT_TYPES = [
  { value: 'INITIAL_LOAD', label: 'Carga inicial' },
  { value: 'MANUAL_INCREASE', label: 'Incremento manual' },
  { value: 'MANUAL_DECREASE', label: 'Decremento manual' },
  { value: 'COUNT_CORRECTION', label: 'Corrección por conteo físico' },
  { value: 'DAMAGE', label: 'Daño / merma' },
  { value: 'SAMPLE', label: 'Muestra' },
  { value: 'TRANSFER_IN', label: 'Entrada por traslado' },
  { value: 'TRANSFER_OUT', label: 'Salida por traslado' },
] as const;

const DECREASE_TYPES = ['MANUAL_DECREASE', 'DAMAGE', 'SAMPLE', 'TRANSFER_OUT'];

const adjustmentDetailSchema = z.object({
  product: z.string().min(1, 'Selecciona un producto'),
  selling_unit_id: z.string().optional(),
  selling_unit_factor: z.string().optional(), // unit_conversion_factor stored for submit
  quantity_change: z.string().optional(),
  quantity_after: z.string().optional(),
});

const adjustmentFormSchema = z.object({
  adjustment_type: z.enum(
    ['INITIAL_LOAD', 'MANUAL_INCREASE', 'MANUAL_DECREASE', 'COUNT_CORRECTION', 'DAMAGE', 'SAMPLE', 'TRANSFER_IN', 'TRANSFER_OUT'],
    { required_error: 'Tipo de ajuste requerido' }
  ),
  reason: z.string().min(1, 'La razón es obligatoria').max(255, 'Máximo 255 caracteres'),
  notes: z.string().nullable().optional(),
  details: z.array(adjustmentDetailSchema).min(1, 'Debe agregar al menos un producto'),
}).superRefine((data, ctx) => {
  const isCountCorrection = data.adjustment_type === 'COUNT_CORRECTION';
  data.details.forEach((detail, index) => {
    if (isCountCorrection) {
      if (!detail.quantity_after || detail.quantity_after === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El stock deseado es requerido', path: ['details', index, 'quantity_after'] });
      } else if (parseFloat(detail.quantity_after) < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El stock no puede ser negativo', path: ['details', index, 'quantity_after'] });
      }
    } else {
      if (!detail.quantity_change || detail.quantity_change === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La cantidad es requerida', path: ['details', index, 'quantity_change'] });
      } else if (parseFloat(detail.quantity_change) === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La cantidad no puede ser cero', path: ['details', index, 'quantity_change'] });
      }
    }
  });
});

type AdjustmentFormValues = z.infer<typeof adjustmentFormSchema>;

// --- DetailRow ---

interface DetailRowProps {
  index: number;
  control: Control<AdjustmentFormValues>;
  register: UseFormRegister<AdjustmentFormValues>;
  setValue: UseFormSetValue<AdjustmentFormValues>;
  errors: FieldErrors<AdjustmentFormValues>;
  productList: ProductMaster[];
  stockMap: Record<string, string>;
  measurementMap: Record<string, string>;
  isCountCorrection: boolean;
  isDecreaseType: boolean;
  onRemove: () => void;
  canRemove: boolean;
}

function DetailRow({
  index, control, register, setValue, errors,
  productList, stockMap, measurementMap,
  isCountCorrection, isDecreaseType, onRemove, canRemove,
}: DetailRowProps) {
  const selectedProductId = useWatch({ control, name: `details.${index}.product` });
  const selectedSellingUnitId = useWatch({ control, name: `details.${index}.selling_unit_id` });

  const { data: productDetail } = useQuery({
    ...v1ProductRetrieveOptions({ path: { id: selectedProductId } }),
    enabled: !!selectedProductId,
  });

  const sellingUnits = productDetail?.selling_units ?? [];
  const selectedSellingUnit = sellingUnits.find((u) => u.id === selectedSellingUnitId);
  const conversionFactor = selectedSellingUnit ? parseFloat(selectedSellingUnit.unit_conversion_factor) : 1;

  const selectedProduct = productList.find((p) => p.id === selectedProductId);
  const baseUnitName = selectedProduct?.measurement_unit
    ? (measurementMap[selectedProduct.measurement_unit] ?? null)
    : null;

  const stockRaw = selectedProductId ? stockMap[selectedProductId] : undefined;
  const stockBase = stockRaw !== undefined ? parseFloat(stockRaw) : null;
  const stockInUnit = stockBase !== null && conversionFactor > 0 ? stockBase / conversionFactor : null;

  const isZeroStock = stockBase !== null && stockBase === 0;
  const isLowStock = stockBase !== null && stockBase > 0 && stockBase < 5;

  const productRegister = register(`details.${index}.product`);

  const quantityPlaceholder = isCountCorrection
    ? `Stock final${selectedSellingUnit ? ` en ${selectedSellingUnit.name}` : ''}`
    : isDecreaseType
    ? `Cant. a reducir${selectedSellingUnit ? ` (${selectedSellingUnit.name})` : ''}`
    : `Cantidad${selectedSellingUnit ? ` (${selectedSellingUnit.name})` : ''}`;

  return (
    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-2">
      <div className="flex gap-2 items-start">
        {/* Product selector */}
        <div className="flex-1 min-w-0">
          <select
            {...productRegister}
            onChange={(e) => {
              productRegister.onChange(e);
              setValue(`details.${index}.selling_unit_id`, '');
              setValue(`details.${index}.selling_unit_factor`, '1');
            }}
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Seleccionar producto --</option>
            {productList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.sku ? ` (${p.sku})` : ''}
              </option>
            ))}
          </select>
          {errors.details?.[index]?.product && (
            <p className="mt-1 text-xs text-red-500">{errors.details[index]!.product?.message}</p>
          )}
        </div>

        {/* Quantity input */}
        <div className="w-36 shrink-0">
          {isCountCorrection ? (
            <>
              <input
                {...register(`details.${index}.quantity_after`)}
                type="number"
                step="0.01"
                min="0"
                placeholder={quantityPlaceholder}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.details?.[index]?.quantity_after && (
                <p className="mt-1 text-xs text-red-500">{errors.details[index]!.quantity_after?.message}</p>
              )}
            </>
          ) : (
            <>
              <input
                {...register(`details.${index}.quantity_change`)}
                type="number"
                step="0.01"
                placeholder={quantityPlaceholder}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.details?.[index]?.quantity_change && (
                <p className="mt-1 text-xs text-red-500">{errors.details[index]!.quantity_change?.message}</p>
              )}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          className="mt-1 p-1.5 text-red-400 hover:text-red-600 disabled:text-gray-300 disabled:cursor-not-allowed cursor-pointer"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Selling unit selector — only shown when product has selling units */}
      {selectedProductId && sellingUnits.length > 0 && (
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <select
            value={selectedSellingUnitId ?? ''}
            onChange={(e) => {
              const unitId = e.target.value;
              const unit = sellingUnits.find((u) => u.id === unitId);
              setValue(`details.${index}.selling_unit_id`, unitId);
              setValue(`details.${index}.selling_unit_factor`, unit?.unit_conversion_factor ?? '1');
            }}
            className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">
              Unidad base{baseUnitName ? ` (${baseUnitName})` : ''}
            </option>
            {sellingUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — × {u.unit_conversion_factor}{baseUnitName ? ` ${baseUnitName}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Stock info badge */}
      {selectedProductId && (
        <div className={cn(
          'flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg',
          isZeroStock
            ? 'bg-red-50 text-red-700 border border-red-100'
            : isLowStock
            ? 'bg-amber-50 text-amber-700 border border-amber-100'
            : 'bg-white text-gray-500 border border-gray-100'
        )}>
          {isZeroStock && <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
          <span>
            Stock actual:{' '}
            <strong>
              {stockBase !== null ? stockBase.toFixed(2) : '—'}
              <span className="font-normal text-gray-400 ml-1">{baseUnitName ?? 'unidades'}</span>
            </strong>
            {selectedSellingUnit && stockInUnit !== null && (
              <span className="text-gray-400 ml-2">
                ≈ <strong className="text-gray-600">{stockInUnit.toFixed(2)}</strong>{' '}
                {selectedSellingUnit.name}
              </span>
            )}
          </span>
          {isZeroStock && <span className="font-semibold">— sin stock</span>}
        </div>
      )}
    </div>
  );
}

// --- AdjustmentForm ---

interface AdjustmentFormProps {
  onSuccess: () => void;
}

export default function AdjustmentForm({ onSuccess }: AdjustmentFormProps) {
  const { selectedBranch } = useBranch();
  const queryClient = useQueryClient();

  const { data: products } = useQuery(v1ProductListOptions());
  const { data: stockData } = useQuery(v1ProductBranchStockListOptions());
  const { data: measurementUnits } = useQuery(v1MeasurementListOptions());

  const stockMap = useMemo<Record<string, string>>(() => {
    if (!Array.isArray(stockData)) return {};
    return Object.fromEntries((stockData as ProductStockSale[]).map((s) => [s.product_id, s.stock]));
  }, [stockData]);

  const measurementMap = useMemo<Record<string, string>>(() => {
    if (!Array.isArray(measurementUnits)) return {};
    return Object.fromEntries((measurementUnits as MeasurementUnit[]).map((m) => [m.id, m.name]));
  }, [measurementUnits]);

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentFormSchema),
    defaultValues: {
      adjustment_type: 'MANUAL_INCREASE',
      reason: '',
      notes: null,
      details: [{ product: '', selling_unit_id: '', selling_unit_factor: '1', quantity_change: '', quantity_after: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'details' });
  const adjustmentType = watch('adjustment_type');
  const isCountCorrection = adjustmentType === 'COUNT_CORRECTION';
  const isDecreaseType = DECREASE_TYPES.includes(adjustmentType);

  const { mutate: createAdjustment, isPending } = useMutation({
    ...v1AdjustmentsCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'v1AdjustmentsList' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'v1ProductBranchStockList' }] });
      toast.success('Ajuste de inventario creado correctamente');
      onSuccess();
    },
    onError: () => {
      toast.error('Error al crear el ajuste. Verifica los datos ingresados.');
    },
  });

  const onSubmit = handleSubmit((data) => {
    const transformedDetails = data.details.map((d) => {
      const factor = d.selling_unit_factor ? parseFloat(d.selling_unit_factor) : 1;
      if (isCountCorrection) {
        return { product: d.product, quantity_after: parseFloat(d.quantity_after!) * factor };
      }
      let qty = parseFloat(d.quantity_change!) * factor;
      if (isDecreaseType && qty > 0) qty = -qty;
      return { product: d.product, quantity_change: qty };
    });

    createAdjustment({
      body: {
        branch: selectedBranch!.id,
        adjustment_type: data.adjustment_type,
        reason: data.reason,
        notes: data.notes ?? null,
        // @ts-expect-error - details items are union types not reflected in generated schema
        details: transformedDetails,
      },
    });
  });

  if (!selectedBranch) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p className="font-medium">Selecciona una sucursal para continuar.</p>
      </div>
    );
  }

  const productList: ProductMaster[] = Array.isArray(products) ? products : [];

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Ajuste</label>
        <select
          {...register('adjustment_type')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {ADJUSTMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        {errors.adjustment_type && (
          <p className="mt-1 text-xs text-red-500">{errors.adjustment_type.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Razón <span className="text-red-500">*</span>
        </label>
        <input
          {...register('reason')}
          type="text"
          placeholder="Ej. Reposición de stock, corrección de inventario..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.reason && <p className="mt-1 text-xs text-red-500">{errors.reason.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
        <textarea
          {...register('notes')}
          rows={2}
          placeholder="Observaciones adicionales..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {isDecreaseType && (
        <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
          Para este tipo de ajuste las cantidades se reducirán del inventario. Ingresa valores positivos.
        </p>
      )}

      {isCountCorrection && (
        <p className="text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
          Ingresa el <strong>stock final deseado</strong>. El sistema calculará la diferencia automáticamente.
        </p>
      )}

      <div>
        <div className="flex justify-between items-center mb-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Productos</label>
            <p className="text-xs text-gray-400 mt-0.5">
              {isCountCorrection
                ? 'Stock final deseado'
                : isDecreaseType
                ? 'Cantidad a reducir'
                : 'Cantidad a agregar'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => append({ product: '', selling_unit_id: '', selling_unit_factor: '1', quantity_change: '', quantity_after: '' })}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar producto
          </button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <DetailRow
              key={field.id}
              index={index}
              control={control}
              register={register}
              setValue={setValue}
              errors={errors}
              productList={productList}
              stockMap={stockMap}
              measurementMap={measurementMap}
              isCountCorrection={isCountCorrection}
              isDecreaseType={isDecreaseType}
              onRemove={() => remove(index)}
              canRemove={fields.length > 1}
            />
          ))}
        </div>

        {errors.details && !Array.isArray(errors.details) && (
          <p className="mt-1 text-xs text-red-500">{errors.details.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {isPending ? 'Guardando...' : 'Crear Ajuste'}
        </button>
      </div>
    </form>
  );
}
