import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { productCreateMutation, productUpdateMutation, categoryListOptions, measurementListOptions, productListQueryKey } from '../../client/@tanstack/react-query.gen';
import type { ProductMasterRequest, Category, MeasurementUnit, ProductMaster } from '../../client/types.gen';

// Define a custom schema in Spanish and more flexible with IDs
const productFormSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(200, 'Máximo 200 caracteres'),
  description: z.string().nullable().optional(),
  cost_price_usd: z.string().min(1, 'El precio es obligatorio').regex(/^-?\d{0,8}(?:\.\d{0,2})?$/, 'Precio inválido (ej: 10.50)'),
  profit_margin: z.string().min(1, 'El margen es obligatorio').regex(/^-?\d{0,3}(?:\.\d{0,2})?$/, 'Margen inválido (ej: 30)'),
  IVA: z.boolean().optional(),
  category: z.string().nullable().optional(),
  measurement_unit: z.string().nullable().optional(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

interface ProductFormProps {
  initialData?: ProductMaster | null;
  onSuccess: () => void;
}

export default function ProductForm({ initialData, onSuccess }: ProductFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!initialData;

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      cost_price_usd: initialData?.cost_price_usd || '',
      profit_margin: initialData?.profit_margin || '',
      IVA: initialData?.IVA || false,
      category: initialData?.category || '',
      measurement_unit: initialData?.measurement_unit || '',
    }
  });

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
    // transform empty strings to null for optional references
    const payload: ProductMasterRequest = {
      ...data,
      category: data.category === '' ? null : data.category,
      measurement_unit: data.measurement_unit === '' ? null : data.measurement_unit,
      description: data.description === '' ? null : data.description,
    } as ProductMasterRequest;

    if (isEditing && initialData) {
      updateMutation.mutate({
        path: { id: initialData.id },
        body: payload
      });
    } else {
      createMutation.mutate({
        body: payload
      });
    }
  };

  const categoryList = Array.isArray(categories) ? categories : [];
  const unitList = Array.isArray(units) ? units : [];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nombre</label>
        <input
          type="text"
          id="name"
          {...register('name')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700">Categoría</label>
        <select
          id="category"
          {...register('category')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
        >
          <option value="">Seleccione una categoría</option>
          {categoryList.map((cat: Category) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>}
      </div>

      <div>
        <label htmlFor="measurement_unit" className="block text-sm font-medium text-gray-700">Unidad de Medida</label>
        <select
          id="measurement_unit"
          {...register('measurement_unit')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
        >
          <option value="">Seleccione una unidad</option>
          {unitList.map((unit: MeasurementUnit) => (
            <option key={unit.id} value={unit.id}>{unit.name}</option>
          ))}
        </select>
        {errors.measurement_unit && <p className="mt-1 text-sm text-red-600">{errors.measurement_unit.message}</p>}
      </div>

       <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="cost_price_usd" className="block text-sm font-medium text-gray-700">Precio Costo (USD)</label>
          <input
            type="number"
            step="0.01"
            id="cost_price_usd"
            {...register('cost_price_usd')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
          />
          {errors.cost_price_usd && <p className="mt-1 text-sm text-red-600">{errors.cost_price_usd.message}</p>}
        </div>

        <div>
          <label htmlFor="profit_margin" className="block text-sm font-medium text-gray-700">Margen de Ganancia (%)</label>
          <input
            type="number"
            step="0.01"
            id="profit_margin"
            {...register('profit_margin')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
          />
           {errors.profit_margin && <p className="mt-1 text-sm text-red-600">{errors.profit_margin.message}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">Descripción</label>
        <textarea
          id="description"
          {...register('description')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
        />
        {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>}
      </div>

      <div className="flex items-center">
        <input
          id="IVA"
          type="checkbox"
          {...register('IVA')}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="IVA" className="ml-2 block text-sm text-gray-900">
          Aplica IVA
        </label>
         {errors.IVA && <p className="mt-1 text-sm text-red-600">{errors.IVA.message}</p>}
      </div>

      <div className="mt-5 sm:mt-6">
        <button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
          className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm disabled:opacity-50"
        >
          {createMutation.isPending || updateMutation.isPending 
            ? (isEditing ? 'Actualizando...' : 'Creando...') 
            : (isEditing ? 'Actualizar Producto' : 'Crear Producto')}
        </button>
      </div>
    </form>
  );
}
