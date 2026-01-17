import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { v1UserInfoRetrieveOptions, v1UserInfoPartialUpdateMutation, v1UserInfoRetrieveQueryKey } from '../../client/@tanstack/react-query.gen';
import { toast } from 'sonner';
import { Loader2, User, Mail } from 'lucide-react';
import type { V1UserInfoPartialUpdateData } from '../../client/types.gen';
import { useEffect } from 'react';

interface ProfileFormValues {
  first_name: string;
  last_name: string;
  email: string;
}

export default function UserProfileForm() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery(v1UserInfoRetrieveOptions());

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<ProfileFormValues>({
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
    }
  });

  useEffect(() => {
    if (user) {
      reset({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
      });
    }
  }, [user, reset]);

  const updateMutation = useMutation({
    ...v1UserInfoPartialUpdateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: v1UserInfoRetrieveQueryKey() });
      toast.success('Perfil actualizado correctamente');
    },
    onError: () => {
      toast.error('Error al actualizar el perfil');
    }
  });

  const onSubmit = (data: V1UserInfoPartialUpdateData['body']) => {
    updateMutation.mutate({ body: data });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900">Información del Perfil</h3>
        <p className="text-sm text-gray-500">Actualiza tu información personal y dirección de correo electrónico.</p>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
              Nombre
            </label>
            <div className="mt-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-4 w-4 text-gray-400" />
              </div>
              <input
                {...register('first_name', { required: 'El nombre es obligatorio' })}
                type="text"
                id="first_name"
                className="block w-full pl-10 h-8 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            {errors.first_name && (
              <p className="mt-1 text-xs text-red-500">{errors.first_name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
              Apellido
            </label>
            <div className="mt-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-4 w-4 text-gray-400" />
              </div>
              <input
                {...register('last_name', { required: 'El apellido es obligatorio' })}
                type="text"
                id="last_name"
                className="block w-full pl-10 h-8 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            {errors.last_name && (
              <p className="mt-1 text-xs text-red-500">{errors.last_name.message}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Correo Electrónico
          </label>
          <div className="mt-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-4 w-4 text-gray-400" />
            </div>
            <input
              {...register('email', { 
                required: 'El correo es obligatorio',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Correo electrónico inválido'
                }
              })}
              type="email"
              id="email"
              className="block w-full h-8 pl-10 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                Actualizando...
              </>
            ) : (
              'Actualizar Perfil'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
