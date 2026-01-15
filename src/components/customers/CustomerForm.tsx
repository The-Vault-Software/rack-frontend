import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { 
  customersCreateMutation, 
  customersUpdateMutation,
  customersListQueryKey 
} from '../../client/@tanstack/react-query.gen';
import type { Customer, CustomerRequest } from '../../client/types.gen';

const customerFormSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(200, 'Máximo 200 caracteres'),
  email: z.string().email('Email inválido').or(z.literal('')).nullable().optional(),
  phone: z.string().max(40, 'Máximo 40 caracteres').nullable().optional(),
  document: z.string().max(40, 'Máximo 40 caracteres').nullable().optional(),
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

interface CustomerFormProps {
  initialData?: Customer | null;
  onSuccess: () => void;
}

export default function CustomerForm({ initialData, onSuccess }: CustomerFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!initialData;

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      document: initialData?.document || '',
    }
  });

  const createMutation = useMutation({
    ...customersCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customersListQueryKey() });
      toast.success('Cliente creado correctamente');
      reset();
      onSuccess();
    },
    onError: () => toast.error('Error al crear el cliente')
  });

  const updateMutation = useMutation({
    ...customersUpdateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customersListQueryKey() });
      toast.success('Cliente actualizado correctamente');
      onSuccess();
    },
    onError: () => toast.error('Error al actualizar el cliente')
  });

  const onSubmit = (data: CustomerFormValues) => {
    const payload: CustomerRequest = {
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      document: data.document || null,
    };

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nombre o Razón Social</label>
          <input
            {...register('name')}
            placeholder="Ej. Juan Pérez o Empresa C.A."
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Identificación (DNI/RUC/NIT)</label>
          <input
            {...register('document')}
            placeholder="Ej. J-12345678-9"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
          />
          {errors.document && <p className="mt-1 text-sm text-red-600">{errors.document.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Teléfono</label>
            <input
              {...register('phone')}
              placeholder="+58 412..."
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
            />
            {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              {...register('email')}
              placeholder="cliente@ejemplo.com"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>
        </div>
      </div>

      <div className="mt-5 sm:mt-6">
        <button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
          className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm disabled:opacity-50"
        >
          {isEditing ? 'Actualizar Cliente' : 'Crear Cliente'}
        </button>
      </div>
    </form>
  );
}
