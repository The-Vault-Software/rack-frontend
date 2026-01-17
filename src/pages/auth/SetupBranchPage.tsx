import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { branchCreateMutation, branchListQueryKey } from '../../client/@tanstack/react-query.gen';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Loader2, Store, MapPin, Phone, Mail } from 'lucide-react';

const setupBranchSchema = z.object({
  name: z.string().min(1, "Nombre de la sucursal requerido"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email válido requerido").optional().or(z.literal('')),
});

type SetupBranchFormValues = z.infer<typeof setupBranchSchema>;

export default function SetupBranchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetupBranchFormValues>({
    resolver: zodResolver(setupBranchSchema),
  });

  const createBranch = useMutation({
    ...branchCreateMutation(),
    onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: branchListQueryKey() });
        toast.success('Sucursal creada exitosamente');
        navigate('/dashboard');
    },
    onError: (error) => {
       console.error(error);
       toast.error("Error al crear la sucursal.");
    }
  });

  const onSubmit = (data: SetupBranchFormValues) => {
    createBranch.mutate({
        body: {
            name: data.name,
            address: data.address || null,
            phone: data.phone || null,
            email: data.email || null,
        }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
       <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Store className="h-6 w-6 text-blue-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Crea tu primera Sucursal
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
           Para terminar la configuración, crea una sucursal donde gestionarás tu inventario y ventas.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nombre de la Sucursal</label>
              <div className="mt-1">
                <Input 
                    id="name" 
                    {...register('name')} 
                    className={errors.name ? "border-red-500" : ""} 
                    placeholder="ej. Sede Principal"
                />
                {errors.name && <p className="mt-2 text-sm text-red-600">{errors.name.message}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">Dirección</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin className="h-4 w-4 text-gray-400" />
                </div>
                <Input 
                    id="address" 
                    {...register('address')} 
                    className="pl-10" 
                    placeholder="Av. Principal..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Teléfono</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-4 w-4 text-gray-400" />
                    </div>
                    <Input 
                        id="phone" 
                        {...register('phone')} 
                        className="pl-10" 
                        placeholder="+58 412..."
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-gray-400" />
                    </div>
                    <Input 
                        id="email" 
                        type="email"
                        {...register('email')} 
                        className="pl-10" 
                        placeholder="sucursal@..."
                    />
                  </div>
                   {errors.email && <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>}
                </div>
            </div>

            <Button type="submit" className="w-full flex justify-center" disabled={createBranch.isPending}>
               {createBranch.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
               Finalizar Configuración
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
