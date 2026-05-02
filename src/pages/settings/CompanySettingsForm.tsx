import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { v1CompanyRetrieveOptions, v1CompanyPartialUpdateMutation, v1CompanyRetrieveQueryKey } from '../../client/@tanstack/react-query.gen';
import { toast } from 'sonner';
import { Loader2, Building2, Mail, CreditCard, Calendar, Layers } from 'lucide-react';
import { useEffect } from 'react';

interface CompanyFormValues {
  name: string;
  email: string;
  rif: string;
}

export default function CompanySettingsForm() {
  const queryClient = useQueryClient();
  const { data: company, isLoading } = useQuery(v1CompanyRetrieveOptions());

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<CompanyFormValues>({
    defaultValues: {
      name: '',
      email: '',
      rif: '',
    }
  });

  useEffect(() => {
    if (company) {
      reset({
        name: company.name || '',
        email: company.email || '',
        rif: company.rif || '',
      });
    }
  }, [company, reset]);

  const updateMutation = useMutation({
    ...v1CompanyPartialUpdateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: v1CompanyRetrieveQueryKey() });
      toast.success('Datos de la empresa actualizados correctamente');
    },
    onError: () => {
      toast.error('Error al actualizar los datos de la empresa');
    }
  });

  const onSubmit = (data: CompanyFormValues) => {
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
      <div className="p-6 border-b border-gray-100 bg-gray-50/50">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Building2 className="h-5 w-5 mr-2 text-blue-600" />
          Información de la Empresa
        </h3>
        <p className="text-sm text-gray-500">Gestiona los datos fiscales y de contacto de tu empresa.</p>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Nombre de la Empresa
            </label>
            <div className="mt-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Building2 className="h-4 w-4 text-gray-400" />
              </div>
              <input
                {...register('name', { required: 'El nombre es obligatorio' })}
                type="text"
                id="name"
                className="block w-full pl-10 h-8 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm border"
              />
            </div>
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="rif" className="block text-sm font-medium text-gray-700">
              RIF / Documento Fiscal
            </label>
            <div className="mt-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <CreditCard className="h-4 w-4 text-gray-400" />
              </div>
              <input
                {...register('rif')}
                type="text"
                id="rif"
                placeholder="J-12345678-9"
                className="block w-full pl-10 h-8 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm border"
              />
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
                className="block w-full h-8 pl-10 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm border"
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100">
          <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center">
            <Layers className="h-4 w-4 mr-2 text-gray-400" />
            Información de Licencia (Solo lectura)
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
              <span className="block text-xs text-gray-500 uppercase font-semibold">Límite de Sucursales</span>
              <div className="flex items-center mt-1">
                <Layers className="h-4 w-4 text-blue-500 mr-2" />
                <span className="text-sm font-medium text-gray-900">{company?.max_branches}</span>
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
              <span className="block text-xs text-gray-500 uppercase font-semibold">Vencimiento de Licencia</span>
              <div className="flex items-center mt-1">
                <Calendar className="h-4 w-4 text-blue-500 mr-2" />
                <span className="text-sm font-medium text-gray-900">
                  {company?.license_date ? new Date(company.license_date).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed min-w-[160px] cursor-pointer"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                Guardando...
              </>
            ) : (
              'Guardar Cambios'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
