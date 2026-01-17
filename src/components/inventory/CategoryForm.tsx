import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { v1CategoryCreateMutation, v1CategoryUpdateMutation, v1CategoryListQueryKey } from '../../client/@tanstack/react-query.gen';
import type { CategoryRequest, Category } from '../../client/types.gen';

const categorySchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(200, 'Máximo 200 caracteres'),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

interface CategoryFormProps {
  initialData?: Category | null;
  onSuccess: () => void;
}

export default function CategoryForm({ initialData, onSuccess }: CategoryFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!initialData;

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: initialData?.name || '',
    }
  });

  const createMutation = useMutation({
    ...v1CategoryCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: v1CategoryListQueryKey() });
      toast.success('Categoría creada exitosamente');
      reset();
      onSuccess();
    },
    onError: (error) => {
      console.error('Failed to create category:', error);
      toast.error('Error al crear la categoría');
    }
  });

  const updateMutation = useMutation({
    ...v1CategoryUpdateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: v1CategoryListQueryKey() });
      toast.success('Categoría actualizada exitosamente');
      onSuccess();
    },
    onError: (error) => {
      console.error('Failed to update category:', error);
      toast.error('Error al actualizar la categoría');
    }
  });

  const onSubmit = (data: CategoryFormValues) => {
    if (isEditing && initialData) {
      updateMutation.mutate({
        path: { id: initialData.id },
        body: data as CategoryRequest
      });
    } else {
      createMutation.mutate({ body: data as CategoryRequest });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nombre de Categoría</label>
        <input
          type="text"
          id="name"
          {...register('name')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div className="mt-5 sm:mt-6">
        <button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
          className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm disabled:opacity-50"
        >
          {createMutation.isPending || updateMutation.isPending 
            ? (isEditing ? 'Actualizando...' : 'Creando...') 
            : (isEditing ? 'Actualizar Categoría' : 'Crear Categoría')}
        </button>
      </div>
    </form>
  );
}
