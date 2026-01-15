import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { loginCreateMutation, userInfoRetrieveOptions } from '../../client/@tanstack/react-query.gen';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Loader2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email({ message: "Por favor ingresa un email válido" }),
  password: z.string().min(1, { message: "La contraseña es requerida" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const from = (location.state as { from?: string })?.from || '/dashboard';
      
      // If they have no company, but are authenticated, they should probably go to create-company
      // unless ProtectedLayout already handles that after navigate('/dashboard')
      // Actually, dashboard will be wrapped by ProtectedLayout which will redirect to /create-company if needed.
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, location.state, user]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const loginMutation = useMutation({
    ...loginCreateMutation(),
    onSuccess: async () => {
      // Invalidate user info to fetch the new session
      await queryClient.invalidateQueries({ queryKey: userInfoRetrieveOptions({}).queryKey });
      toast.success('Sesión iniciada correctamente');
      navigate('/dashboard');
    },
    onError: (error) => {
      console.error(error);
      toast.error("Credenciales inválidas o error en el servidor.");
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate({
        body: data as never, // Forced cast because types say 'never' for body
      });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Iniciar Sesión
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          O{' '}
          <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
            regístrate para comenzar
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="mt-1">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className={errors.email ? "border-red-500" : ""}
                />
                {errors.email && (
                  <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <div className="mt-1">
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...register('password')}
                  className={errors.password ? "border-red-500" : ""}
                />
                {errors.password && (
                  <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>
            </div>



            <div>
              <Button
                type="submit"
                className="w-full flex justify-center"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                Entrar
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
