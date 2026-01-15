import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { measurementCreateMutation, measurementUpdateMutation, measurementListQueryKey } from '../../client/@tanstack/react-query.gen';
import type { MeasurementUnitRequest, MeasurementUnit } from '../../client/types.gen';

const unitSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(200, 'Máximo 200 caracteres'),
  decimals: z.boolean().optional(),
});

type UnitFormValues = z.infer<typeof unitSchema>;

interface UnitFormProps {
  initialData?: MeasurementUnit | null;
  onSuccess: () => void;
}

export default function UnitForm({ initialData, onSuccess }: UnitFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!initialData;

  const { register, handleSubmit, formState: { errors }, reset } = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      name: initialData?.name || '',
      decimals: initialData?.decimals || false
    }
  });

  const createMutation = useMutation({
    ...measurementCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: measurementListQueryKey() });
      toast.success('Unidad de medida creada exitosamente');
      reset();
      onSuccess();
    },
    onError: (error) => {
      console.error('Failed to create unit:', error);
      toast.error('Error al crear la unidad de medida');
    }
  });

  const updateMutation = useMutation({
    ...measurementUpdateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: measurementListQueryKey() });
      toast.success('Unidad de medida actualizada exitosamente');
      onSuccess();
    },
    onError: (error) => {
      console.error('Failed to update unit:', error);
      toast.error('Error al actualizar la unidad de medida');
    }
  });

  const onSubmit = (data: UnitFormValues) => {
    if (isEditing && initialData) {
      updateMutation.mutate({
        path: { id: initialData.id },
        body: data as MeasurementUnitRequest
      });
    } else {
      createMutation.mutate({ body: data as MeasurementUnitRequest });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nombre de Unidad</label>
        <input
          type="text"
          id="name"
          {...register('name')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div className="flex items-center">
        <input
          id="decimals"
          type="checkbox"
          {...register('decimals')}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="decimals" className="ml-2 block text-sm text-gray-900">
          Permite Decimales
        </label>
        {errors.decimals && <p className="mt-1 text-sm text-red-600">{errors.decimals.message}</p>}
      </div>

      <div className="mt-5 sm:mt-6">
        <button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
          className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm disabled:opacity-50"
        >
          {createMutation.isPending || updateMutation.isPending 
            ? (isEditing ? 'Actualizando...' : 'Creando...') 
            : (isEditing ? 'Actualizar Unidad' : 'Crear Unidad')}
        </button>
      </div>
    </form>
  );
}
