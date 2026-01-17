import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { 
  productCreateMutation, 
  productUpdateMutation, 
  categoryListOptions, 
  measurementListOptions, 
  productListQueryKey,
  productRetrieveOptions 
} from '../../client/@tanstack/react-query.gen';
import type { Category, MeasurementUnit, ProductMaster } from '../../client/types.gen';
import { Plus, Trash2, Package, Layers, Divide } from 'lucide-react';

// Define the selling unit schema
const sellingUnitSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'El nombre es obligatorio').max(100, 'Máximo 100 caracteres'),
  unit_conversion_factor: z.string().min(1, 'El factor es obligatorio').regex(/^\d+(?:\.\d+)?$/, 'Factor inválido (ej: 12.00)'),
  measurement_unit: z.string().min(1, 'La unidad es obligatoria'),
});

// Define a custom schema in Spanish and more flexible with IDs
const productFormSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(200, 'Máximo 200 caracteres'),
  description: z.string().nullable().optional(),
  cost_price_usd: z.string().min(1, 'El precio es obligatorio').regex(/^-?\d{0,8}(?:\.\d{0,2})?$/, 'Precio inválido (ej: 10.50)'),
  profit_margin: z.string().min(1, 'El margen es obligatorio').regex(/^-?\d{0,3}(?:\.\d{0,2})?$/, 'Margen inválido (ej: 30)'),
  IVA: z.boolean().optional(),
  category: z.string().nullable().optional(),
  measurement_unit: z.string().nullable().optional(),
  selling_units: z.array(sellingUnitSchema).optional(),
}).superRefine((data, ctx) => {
  if (data.selling_units) {
    const names = data.selling_units.map(u => u.name.trim().toLowerCase());
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicates.length > 0) {
      data.selling_units.forEach((unit, index) => {
        if (duplicates.includes(unit.name.trim().toLowerCase())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'El nombre de la unidad de venta ya existe en este producto',
            path: ['selling_units', index, 'name'],
          });
        }
      });
    }
  }
});

type ProductFormValues = z.infer<typeof productFormSchema>;

interface ProductFormProps {
  initialData?: ProductMaster | null;
  onSuccess: () => void;
}

export default function ProductForm({ initialData, onSuccess }: ProductFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!initialData;
  const [activeTab, setActiveTab] = useState<'basic' | 'selling_units'>('basic');
  const [fractionModes, setFractionModes] = useState<Record<number, boolean>>({});

  const { register, handleSubmit, formState: { errors }, reset, control, watch, setValue } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      cost_price_usd: initialData?.cost_price_usd || '',
      profit_margin: initialData?.profit_margin || '',
      IVA: initialData?.IVA || false,
      category: initialData?.category || '',
      measurement_unit: initialData?.measurement_unit || '',
      selling_units: []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "selling_units"
  });

  // Fetch full product detail to get selling_units if editing
  // The listing API does not include selling_units for performance
  const { data: fullProduct, isLoading: isLoadingDetail } = useQuery({
    ...productRetrieveOptions({ path: { id: initialData?.id || '' } }),
    enabled: isEditing && !!initialData?.id
  });

  useEffect(() => {
    if (fullProduct) {
      reset({
        name: fullProduct.name,
        description: fullProduct.description,
        cost_price_usd: fullProduct.cost_price_usd,
        profit_margin: fullProduct.profit_margin,
        IVA: fullProduct.IVA,
        category: fullProduct.category || '',
        measurement_unit: fullProduct.measurement_unit || '',
        // @ts-expect-error - selling_units is not in the generated type yet
        selling_units: fullProduct.selling_units || []
      });
    }
  }, [fullProduct, reset]);

  const { data: categories } = useQuery(categoryListOptions());
  const { data: units } = useQuery(measurementListOptions());

  const createMutation = useMutation({
    ...productCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productListQueryKey() });
      toast.success('Producto creado exitosamente');
      reset();
      onSuccess();
    },
    onError: (error) => {
      console.error('Failed to create product:', error);
      toast.error('Error al crear el producto');
    }
  });

  const updateMutation = useMutation({
    ...productUpdateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productListQueryKey() });
      toast.success('Producto actualizado exitosamente');
      onSuccess();
    },
    onError: (error) => {
      console.error('Failed to update product:', error);
      toast.error('Error al actualizar el producto');
    }
  });

  const onSubmit = (data: ProductFormValues) => {
    const payload = {
      ...data,
      category: data.category === '' ? null : data.category,
      measurement_unit: data.measurement_unit === '' ? null : data.measurement_unit,
      description: data.description === '' ? null : data.description,
      selling_units: (data.selling_units || []).map(unit => ({
        ...unit,
        unit_conversion_factor: unit.unit_conversion_factor.toString()
      }))
    };

    if (isEditing && initialData) {
      updateMutation.mutate({
        path: { id: initialData.id },
        // @ts-expect-error - payload has selling_units not in the generated type yet
        body: payload as ProductMaster
      });
    } else {
      createMutation.mutate({
        // @ts-expect-error - payload has selling_units not in the generated type yet
        body: payload as ProductMaster
      });
    }
  };

  const categoryList = Array.isArray(categories) ? categories : [];
  const unitList = Array.isArray(units) ? units : [];

  if (isEditing && isLoadingDetail) {
    return (
      <div className="p-8 text-center bg-white rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-500">Cargando detalles del producto...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Visual Tabs with premium look */}
      <div className="flex border-b border-gray-100 p-1 bg-gray-50/50 rounded-t-lg">
        <button
          type="button"
          onClick={() => setActiveTab('basic')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
            activeTab === 'basic' 
              ? 'bg-white text-blue-600 shadow-sm ring-1 ring-gray-200' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
          }`}
        >
          <Package className={`h-4 w-4 ${activeTab === 'basic' ? 'text-blue-500' : 'text-gray-400'}`} />
          Información Básica
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('selling_units')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
            activeTab === 'selling_units' 
              ? 'bg-white text-blue-600 shadow-sm ring-1 ring-gray-200' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
          }`}
        >
          <Layers className={`h-4 w-4 ${activeTab === 'selling_units' ? 'text-blue-500' : 'text-gray-400'}`} />
          Unidades de Venta
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-1">
        {activeTab === 'basic' ? (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Nombre del Producto</label>
              <input
                type="text"
                id="name"
                {...register('name')}
                placeholder="Ej: Refresco de Cola 500ml"
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2.5 outline-none transition-all"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600 font-medium">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select
                  id="category"
                  {...register('category')}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2.5 outline-none bg-white cursor-pointer"
                >
                  <option value="">Sin categoría</option>
                  {categoryList.map((cat: Category) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>}
              </div>

              <div>
                <label htmlFor="measurement_unit" className="block text-sm font-medium text-gray-700 mb-1">Unidad Base</label>
                <select
                  id="measurement_unit"
                  {...register('measurement_unit')}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2.5 outline-none bg-white cursor-pointer"
                >
                  <option value="">Seleccione una unidad</option>
                  {unitList.map((unit: MeasurementUnit) => (
                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                  ))}
                </select>
                {errors.measurement_unit && <p className="mt-1 text-sm text-red-600">{errors.measurement_unit.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cost_price_usd" className="block text-sm font-medium text-gray-700 mb-1">Precio Costo (Base USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    step="0.0001"
                    id="cost_price_usd"
                    {...register('cost_price_usd')}
                    placeholder="0.00"
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2.5 pl-7 outline-none"
                  />
                </div>
                {errors.cost_price_usd && <p className="mt-1 text-sm text-red-600">{errors.cost_price_usd.message}</p>}
              </div>

              <div>
                <label htmlFor="profit_margin" className="block text-sm font-medium text-gray-700 mb-1">Margen de Ganancia (%)</label>
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                  <input
                    type="number"
                    step="0.01"
                    id="profit_margin"
                    {...register('profit_margin')}
                    placeholder="30.00"
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2.5 outline-none"
                  />
                </div>
                {errors.profit_margin && <p className="mt-1 text-sm text-red-600">{errors.profit_margin.message}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                id="description"
                rows={3}
                {...register('description')}
                placeholder="Opcional: Detalles adicionales del producto..."
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2.5 outline-none"
              />
              {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>}
            </div>

            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <input
                id="IVA"
                type="checkbox"
                {...register('IVA')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
              />
              <label htmlFor="IVA" className="ml-2 block text-sm text-gray-700 cursor-pointer font-medium">
                Aplica IVA (16%)
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-in slide-in-from-right-2 duration-300">
            <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-lg border border-blue-100">
              <div className="max-w-[70%]">
                <h3 className="text-sm font-semibold text-blue-900">Unidades de Venta Alternativas</h3>
                <p className="text-xs text-blue-700 mt-0.5">Define empaques (Caja, Bulto) con factores de conversión respecto a la unidad base.</p>
              </div>
              <button
                type="button"
                onClick={() => append({ name: '', unit_conversion_factor: '', measurement_unit: '' })}
                className="inline-flex items-center px-3 py-2 border border-blue-200 text-xs font-bold rounded-lg text-blue-700 bg-white hover:bg-blue-50 focus:outline-none ring-offset-2 focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Añadir
              </button>
            </div>

            {fields.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/30">
                <Layers className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-3 text-sm text-gray-500 font-medium">Sin unidades de venta adicionales</p>
                <button
                  type="button"
                  onClick={() => append({ name: '', unit_conversion_factor: '', measurement_unit: '' })}
                  className="mt-4 text-sm font-bold text-blue-600 hover:text-blue-700"
                >
                  Comenzar a añadir empaques
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {fields.map((field, index) => (
                  <div key={field.id} className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm relative group hover:border-blue-200 hover:shadow-md transition-all duration-200">
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="absolute -top-2 -right-2 p-1.5 bg-white text-gray-400 hover:text-red-500 border border-gray-100 shadow-sm hover:border-red-100 rounded-full transition-all z-10 opacity-0 group-hover:opacity-100"
                      title="Eliminar unidad"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                      {/* Name Column */}
                      <div className="md:col-span-5">
                        <div className="h-6 mb-1.5 flex items-center">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nombre de Venta</label>
                        </div>
                        <input
                          type="text"
                          {...register(`selling_units.${index}.name` as const)}
                          placeholder="Ej: Bulto 24"
                          className={`block w-full rounded-lg border shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border-gray-200 p-2.5 outline-none transition-all ${errors.selling_units?.[index]?.name ? 'border-red-300 bg-red-50/10' : ''}`}
                        />
                        {errors.selling_units?.[index]?.name && (
                          <p className="mt-1 text-xs text-red-600 font-medium">{errors.selling_units[index]?.name?.message}</p>
                        )}
                      </div>
                      
                      {/* Factor Column */}
                      <div className="md:col-span-3">
                        <div className="h-6 mb-1.5 flex justify-between items-center">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {fractionModes[index] ? 'Contenido' : 'Factor'}
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const currentMode = fractionModes[index];
                              setFractionModes(prev => ({ ...prev, [index]: !currentMode }));
                              setValue(`selling_units.${index}.unit_conversion_factor`, '');
                            }}
                            className={`p-1 rounded-md transition-all ${fractionModes[index] ? 'bg-blue-100 text-blue-600' : 'text-gray-300 hover:text-blue-500 hover:bg-blue-50'}`}
                            title={fractionModes[index] ? 'Modo Multiplicador' : 'Modo Fraccionario'}
                          >
                            <Divide className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="relative">
                          {fractionModes[index] ? (
                            <div>
                              <input
                                type="number"
                                step="1"
                                placeholder="30"
                                onChange={(e) => {
                                  const divisor = parseFloat(e.target.value);
                                  if (divisor > 0) {
                                    const result = (1 / divisor).toFixed(6);
                                    setValue(`selling_units.${index}.unit_conversion_factor`, result);
                                  } else {
                                    setValue(`selling_units.${index}.unit_conversion_factor`, '');
                                  }
                                }}
                                className="block w-full rounded-lg border border-blue-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2.5 outline-none bg-blue-50/20"
                              />
                              <div className="absolute -bottom-5 left-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[9px] text-blue-500 font-bold whitespace-nowrap">
                                  FACTOR: {watch(`selling_units.${index}.unit_conversion_factor`)}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <input
                              type="number"
                              step="0.000001"
                              {...register(`selling_units.${index}.unit_conversion_factor` as const)}
                              placeholder="24.00"
                              className="block w-full rounded-lg border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2.5 outline-none"
                            />
                          )}
                        </div>
                        {errors.selling_units?.[index]?.unit_conversion_factor && (
                          <p className="mt-1 text-xs text-red-600 font-medium">{errors.selling_units[index]?.unit_conversion_factor?.message}</p>
                        )}
                      </div>

                      {/* Measurement Unit Column */}
                      <div className="md:col-span-4">
                        <div className="h-6 mb-1.5 flex items-center">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">U. de Medida</label>
                        </div>
                        <select
                          {...register(`selling_units.${index}.measurement_unit` as const)}
                          className="block w-full rounded-lg border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2.5 outline-none bg-white cursor-pointer"
                        >
                          <option value="">Seleccione...</option>
                          {unitList.map((unit: MeasurementUnit) => (
                            <option key={unit.id} value={unit.id}>{unit.name}</option>
                          ))}
                        </select>
                        {errors.selling_units?.[index]?.measurement_unit && (
                          <p className="mt-1 text-xs text-red-600 font-medium">{errors.selling_units[index]?.measurement_unit?.message}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Context Help */}
            <div className="mt-6 flex gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
               <div className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <span className="text-amber-700 text-xs font-bold">i</span>
               </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                El <strong>Factor de Conversión</strong> debe indicar cuántas unidades base contiene esta unidad de venta. 
                <br /><span className="opacity-70 italic text-[10px]">Ejemplo: Si la base es "Unidad" y quieres vender en "Bulto 24", el factor es 24.00.</span>
              </p>
            </div>
          </div>
        )}

        {/* Global form errors if any not tied to fields */}
        {Object.keys(errors).length > 0 && !activeTab && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-600 font-medium italic">Hay errores en el formulario. Por favor revisa los campos.</p>
            </div>
        )}

        <div className="pt-6 border-t border-gray-100 mt-8">
          <button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="group relative inline-flex justify-center w-full rounded-xl border border-transparent shadow-md px-4 py-3 bg-blue-600 text-base font-bold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm disabled:opacity-50 transition-all duration-300 ring-offset-white"
          >
            <span className="flex items-center gap-2">
              {createMutation.isPending || updateMutation.isPending 
                ? (
                    <>
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        {isEditing ? 'Actualizando...' : 'Creando...'}
                    </>
                ) 
                : (
                    <>
                        {isEditing ? 'Guardar Cambios' : 'Registrar Producto'}
                    </>
                )}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
