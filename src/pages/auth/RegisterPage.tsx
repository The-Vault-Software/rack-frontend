import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { registerCreateMutation, loginCreateMutation, userInfoRetrieveOptions, companyRetrieveOptions } from '../../client/@tanstack/react-query.gen';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Loader2, ArrowRight, Building2, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Step 1: Company Schema
const companySchema = z.object({
  companyName: z.string().min(1, "Nombre de la empresa requerido"),
  companyEmail: z.string().email("Email corporativo inválido"),
});

// Step 2: User Schema
const userSchema = z.object({
  username: z.string().min(3, "Usuario debe tener al menos 3 caracteres").regex(/^[\w.@+-]+$/, "Caracteres no permitidos"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  // Honeypot field - should remain empty
  website_url: z.string().max(0, "Bots no permitidos").optional(),
});

// Combined Schema for final submission (though we validate steps individually)
const combinedSchema = companySchema.merge(userSchema);

type RegistrationFormValues = z.infer<typeof combinedSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<RegistrationFormValues>({
    resolver: zodResolver(combinedSchema),
    mode: 'onChange'
  });

  const nextStep = async () => {
    let isValid = false;
    if (step === 1) {
      isValid = await trigger(['companyName', 'companyEmail']);
    }

    if (isValid) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  // Mutations
  const registerMutation = useMutation({
    ...registerCreateMutation(),
  });

  const loginMutation = useMutation({
    ...loginCreateMutation(),
  });

  const processRegistration = async (data: RegistrationFormValues) => {
    // 0. Verify simple captcha
    // (Already verified by Zod max(0) on website_url)
    if (data.website_url && data.website_url.length > 0) return; // Silent fail for bots

    try {
        // 1. Create Company FIRST (direct fetch to bypass auth interceptors)
        const licenseDate = new Date();
        licenseDate.setFullYear(licenseDate.getFullYear() + 1);

        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        
        const companyResponse = await fetch(`${baseUrl}/v1/company/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                name: data.companyName,
                email: data.companyEmail,
                max_branches: 1,
                license_date: licenseDate.toISOString().split('T')[0]
            })
        });

        if (!companyResponse.ok) {
            const errorData = await companyResponse.json();
            // Store the error object to handle it in the catch block if needed, 
            // or handle it here and throw.
            throw errorData; 
        }

        const company = await companyResponse.json();

        // 2. Register User with the real company_id
        await registerMutation.mutateAsync({
            body: {
                username: data.username,
                email: data.email,
                password: data.password,
                first_name: data.first_name,
                last_name: data.last_name,
                company_id: company.id, // Use the real company ID
            }
        });

        // 3. Login User
        await loginMutation.mutateAsync({
            body: {
                email: data.email,
                password: data.password
            } as never
        });

        // 4. Invalidate and Navigate
        await queryClient.invalidateQueries({ queryKey: userInfoRetrieveOptions({}).queryKey });
        await queryClient.invalidateQueries({ queryKey: companyRetrieveOptions({}).queryKey });
        toast.success('Cuenta y empresa creadas exitosamente');
        
        // Go to Setup Branch
        navigate('/setup-branch');

    } catch (error: unknown) {
        console.error(error);
        
        let message = "Error durante el registro.";
        
        // Helper to extract messages from DRF-like error objects
        const getFirstErrorMessage = (errObj: unknown): string | null => {
            if (!errObj || typeof errObj !== 'object') return null;
            
            const obj = errObj as Record<string, unknown>;
            
            // If it has a detail property
            if (obj.detail && typeof obj.detail === 'string') return obj.detail;
            
            // If it's a field-error object { email: ["..."], username: ["..."] }
            const fields = Object.keys(obj);
            if (fields.length > 0) {
                const firstField = fields[0];
                const fieldErrors = obj[firstField];
                if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
                    return `${firstField}: ${fieldErrors[0]}`;
                } else if (typeof fieldErrors === 'string') {
                    return `${firstField}: ${fieldErrors}`;
                }
            }
            return null;
        };

        const apiError = error as { body?: unknown; detail?: string; [key: string]: unknown };

        // Handle error from mutateAsync (wrapped in 'body')
        if (apiError.body) {
            const msg = getFirstErrorMessage(apiError.body);
            if (msg) message = msg;
        } 
        // Handle direct fetch threw object (companyResponse)
        else {
            const msg = getFirstErrorMessage(apiError);
            if (msg) message = msg;
            else if (error instanceof Error) message = error.message;
        }

        // Friendly translations for common errors
        if (message.includes("Company with this name already exists")) message = "El nombre de esta empresa ya está registrado.";
        if (message.includes("Company with this email already exists")) message = "Este correo corporativo ya está en uso.";
        if (message.includes("user with this email already exists")) message = "Este correo electrónico ya está registrado.";
        if (message.includes("A user with that username already exists")) message = "Este nombre de usuario ya está en uso.";

        toast.error(message);
    }
  };

  const onSubmit = (data: RegistrationFormValues) => {
    processRegistration(data);
  };

  const isPending = registerMutation.isPending || loginMutation.isPending;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {step === 1 ? 'Registra tu Empresa' : 'Crea tu Usuario'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
            {step === 1 ? (
                <>
                    Comienza gratis. ¿Ya tienes cuenta?{' '}
                    <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
                    Inicia sesión
                    </Link>
                </>
            ) : (
                'Configura tus credenciales de acceso.'
            )}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 overflow-hidden relative min-h-[400px]">
             
            
            <ol className="flex items-center w-full mb-8 space-x-2 text-sm font-medium text-center text-gray-500 bg-white border border-gray-200 rounded-lg shadow-sm dark:text-gray-400 sm:text-base dark:bg-gray-800 dark:border-gray-700 p-3 sm:p-4 sm:space-x-4">
                <li className={`flex items-center ${step >= 1 ? 'text-blue-600 dark:text-blue-500' : ''}`}>
                    <span className={`flex items-center justify-center w-5 h-5 mr-2 text-xs border ${step >= 1 ? 'border-blue-600' : 'border-gray-500'} rounded-full shrink-0`}>
                        1
                    </span>
                    Empresa
                    <svg className="w-3 h-3 ml-2 sm:ml-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 12 10">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m7 9 4-4-4-4M1 9l4-4-4-4"/>
                    </svg>
                </li>
                <li className={`flex items-center ${step >= 2 ? 'text-blue-600 dark:text-blue-500' : ''}`}>
                    <span className={`flex items-center justify-center w-5 h-5 mr-2 text-xs border ${step >= 2 ? 'border-blue-600' : 'border-gray-500'} rounded-full shrink-0`}>
                        2
                    </span>
                    Usuario
                </li>
            </ol>


           <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
             <AnimatePresence mode="wait">
                {step === 1 && (
                    <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                    >
                        <div>
                            <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">Nombre de la Empresa</label>
                            <div className="mt-1 relative">
                                <Building2 className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
                                <Input 
                                    id="companyName" 
                                    {...register('companyName')} 
                                    className={`pl-10 ${errors.companyName ? "border-red-500" : ""}`}
                                    placeholder="Acme Corp"
                                />
                            </div>
                            {errors.companyName && <p className="mt-2 text-sm text-red-600">{errors.companyName.message}</p>}
                        </div>

                        <div>
                            <label htmlFor="companyEmail" className="block text-sm font-medium text-gray-700">Email Corporativo</label>
                            <div className="mt-1">
                                <Input 
                                    id="companyEmail" 
                                    type="email"
                                    {...register('companyEmail')} 
                                    className={errors.companyEmail ? "border-red-500" : ""}
                                    placeholder="contacto@acme.com"
                                />
                            </div>
                            {errors.companyEmail && <p className="mt-2 text-sm text-red-600">{errors.companyEmail.message}</p>}
                        </div>

                         <div className="flex justify-end">
                            <Button type="button" onClick={nextStep} className="w-full sm:w-auto">
                                Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </motion.div>
                )}

                {step === 2 && (
                    <motion.div
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                    >
                        {/* HONEYPOT FIELD (Hidden) */}
                         <div className="absolute opacity-0 -z-50 pointer-events-none">
                            <label htmlFor="website_url">Website</label>
                            <input
                                id="website_url"
                                type="text"
                                tabIndex={-1}
                                autoComplete="off"
                                {...register('website_url')}
                            />
                        </div>


                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700">Nombre de Usuario</label>
                            <div className="mt-1 relative">
                                <User className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
                                <Input 
                                    id="username" 
                                    {...register('username')} 
                                    className={`pl-10 ${errors.username ? "border-red-500" : ""}`}
                                    placeholder="juan_perez"
                                />
                            </div>
                            {errors.username && <p className="mt-2 text-sm text-red-600">{errors.username.message}</p>}
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Personal</label>
                            <div className="mt-1">
                                <Input 
                                    id="email" 
                                    type="email"
                                    {...register('email')} 
                                    className={errors.email ? "border-red-500" : ""}
                                    placeholder="juan@email.com"
                                />
                            </div>
                            {errors.email && <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>}
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
                            </div>
                            {errors.password && <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>}
                        </div>

                        <div className="flex justify-between gap-4">
                             <Button type="button" variant="outline" onClick={prevStep} disabled={isPending}>
                                Atrás
                            </Button>
                            <Button type="submit" className="flex-1 justify-center" disabled={isPending}>
                                {isPending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                                Finalizar Registro
                            </Button>
                        </div>
                    </motion.div>
                )}
             </AnimatePresence>
          </form>
        </div>
      </div>
    </div>
  );
}
