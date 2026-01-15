import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { registerCreateMutation, userInfoRetrieveOptions } from '../../client/@tanstack/react-query.gen';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Loader2 } from 'lucide-react';
import type { RegisterUserRequestWritable } from '../../client/types.gen';

const registerSchema = z.object({
  username: z.string().min(3, "Usuario debe tener al menos 3 caracteres").regex(/^[\w.@+-]+$/, "Caracteres no permitidos"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const registerMutation = useMutation({
    ...registerCreateMutation(),
    onSuccess: async () => {
      // Invalidate user info and navigate
      await queryClient.invalidateQueries({ queryKey: userInfoRetrieveOptions({}).queryKey });
      toast.success('Cuenta creada exitosamente');
      navigate('/create-company'); 
    },
    onError: (error) => {
      console.error(error);
      let message = "Error al registrarse.";
      
      // Handle hey-api error structure
      if (error && typeof error === 'object' && 'body' in error) {
        const body = (error as { body?: { detail?: string } }).body;
        if (body?.detail) {
          message = body.detail;
        }
      } else if (error instanceof Error) {
        message = error.message;
      }
      
      toast.error(message);
    },
  });

  const onSubmit = (data: RegisterFormValues) => {
    // As the type requires company_id, we provide a placeholder. 
    // In a real flow, the backend might ignore this for new signups or handle it accordingly.
    const registrationData: RegisterUserRequestWritable = {
      ...data,
      company_id: '00000000-0000-0000-0000-000000000000', // Placeholder for type safety
    };

    registerMutation.mutate({
        body: registrationData
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Crear una cuenta
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
            Inicia sesión
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">Usuario</label>
              <div className="mt-1">
                <Input 
                  id="username" 
                  {...register('username')} 
                  className={errors.username ? "border-red-500" : ""} 
                  placeholder="ej. juan_perez"
                />
                {errors.username && <p className="mt-2 text-sm text-red-600">{errors.username.message}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
              <div className="mt-1">
                <Input 
                  id="email" 
                  type="email" 
                  {...register('email')} 
                  className={errors.email ? "border-red-500" : ""} 
                  placeholder="correo@ejemplo.com"
                />
                {errors.email && <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>}
              </div>
            </div>

            <div className="flex gap-4">
                <div className="w-1/2">
                    <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">Nombre</label>
                    <div className="mt-1">
                        <Input id="first_name" {...register('first_name')} placeholder="Juan" />
                    </div>
                </div>
                <div className="w-1/2">
                    <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">Apellido</label>
                    <div className="mt-1">
                        <Input id="last_name" {...register('last_name')} placeholder="Pérez" />
                    </div>
                </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Contraseña</label>
              <div className="mt-1">
                <Input 
                  id="password" 
                  type="password" 
                  {...register('password')} 
                  className={errors.password ? "border-red-500" : ""} 
                  placeholder="••••••••"
                />
                {errors.password && <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>}
              </div>
            </div>



            <div>
              <Button type="submit" className="w-full flex justify-center" disabled={registerMutation.isPending}>
                {registerMutation.isPending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                Registrarse
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
