import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { companyCreateMutation, userInfoRetrieveOptions, companyRetrieveOptions } from '../../client/@tanstack/react-query.gen';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Loader2 } from 'lucide-react';

const createCompanySchema = z.object({
  name: z.string().min(1, "Nombre de la compañía requerido"),
  email: z.string().email("Email de contacto válido requerido"),
});

type CreateCompanyFormValues = z.infer<typeof createCompanySchema>;

export default function CreateCompanyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateCompanyFormValues>({
    resolver: zodResolver(createCompanySchema),
  });

  const createCompany = useMutation({
    ...companyCreateMutation(),
    onSuccess: async () => {
        // Invalidate user info and company retrieve
        await queryClient.invalidateQueries({ queryKey: userInfoRetrieveOptions({}).queryKey });
        await queryClient.invalidateQueries({ queryKey: companyRetrieveOptions({}).queryKey });
        toast.success('Compañía configurada correctamente');
        navigate('/dashboard');
    },
    onError: (error) => {
       console.error(error);
       toast.error("Error al crear la compañía.");
    }
  });

  const onSubmit = (data: CreateCompanyFormValues) => {
    // We need to provide defaults for required fields max_branches and license_date
    const licenseDate = new Date();
    licenseDate.setFullYear(licenseDate.getFullYear() + 1); // 1 year license
    
    createCompany.mutate({
        body: {
            name: data.name,
            email: data.email,
            max_branches: 1, // Default
            license_date: licenseDate.toISOString().split('T')[0] // YYYY-MM-DD
        }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
       <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Configura tu Compañía
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
           Para comenzar, necesitamos algunos detalles de tu empresa.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nombre de la Compañía</label>
              <div className="mt-1">
                <Input id="name" {...register('name')} className={errors.name ? "border-red-500" : ""} />
                {errors.name && <p className="mt-2 text-sm text-red-600">{errors.name.message}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Corporativo</label>
              <div className="mt-1">
                <Input id="email" type="email" {...register('email')} className={errors.email ? "border-red-500" : ""} />
                {errors.email && <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>}
              </div>
            </div>



            <Button type="submit" className="w-full flex justify-center" disabled={createCompany.isPending}>
               {createCompany.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
               Crear Compañía y Continuar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
