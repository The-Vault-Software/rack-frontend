import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, UserPlus, Users } from 'lucide-react';
import {
  v1CompanyUsersListOptions,
  v1CompanyUsersListQueryKey,
  v1CompanyUsersPartialUpdateMutation,
  v1RegisterCreateMutation,
} from '../../client/@tanstack/react-query.gen';
import type { CompanyUser } from '../../client/types.gen';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import Modal from '../../components/ui/Modal';
import ActionConfirmationModal from '../../components/ui/ActionConfirmationModal';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propietario',
  MANAGER: 'Gerente',
  EMPLOYEE: 'Empleado',
};

const newUserSchema = z.object({
  first_name: z.string().min(1, 'El nombre es obligatorio'),
  last_name: z.string().min(1, 'El apellido es obligatorio'),
  username: z.string().min(3, 'Mínimo 3 caracteres').regex(/^[\w.@+-]+$/, 'Solo letras, números y @ . + - _'),
  email: z.string().email('Correo inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  branch_ids: z.array(z.string()).min(1, 'Asigna al menos una sucursal'),
});

type NewUserValues = z.infer<typeof newUserSchema>;

// DRF answers field errors as { field: ["message"] }; show the first one.
function firstApiError(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  for (const value of Object.values(error as Record<string, unknown>)) {
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    if (typeof value === 'string') return value;
  }
  return null;
}

export default function UsersSettings() {
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const { branches } = useBranch();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<CompanyUser | null>(null);

  const isOwner = me?.role === 'OWNER';
  // The list is owner-only on the server; don't fire a request bound to 403.
  const { data: users = [], isLoading, isError } = useQuery({ ...v1CompanyUsersListOptions(), enabled: isOwner });
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? 'Sucursal eliminada';

  const updateMutation = useMutation({
    ...v1CompanyUsersPartialUpdateMutation(),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: v1CompanyUsersListQueryKey() });
      toast.success(updated.is_active ? 'Usuario reactivado' : 'Usuario desactivado');
    },
    onError: (error) => toast.error(firstApiError(error) ?? 'No se pudo actualizar el usuario'),
  });

  if (!isOwner) {
    return <p className="text-sm text-gray-500">Solo el propietario de la empresa puede administrar usuarios.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Usuarios</h2>
          <p className="text-sm text-gray-500">Crea cuentas para tu equipo y desactívalas cuando dejen de necesitar acceso.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          Nuevo usuario
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
        ) : isError ? (
          <p className="p-6 text-sm text-red-600">No se pudieron cargar los usuarios.</p>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-gray-400">
            <Users className="mb-2 h-8 w-8" />
            <p className="text-sm">Todavía no hay usuarios.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Sucursales</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => {
                const isMe = u.email === me?.email;
                const editable = !isMe && u.role !== 'OWNER';
                return (
                  <tr key={u.id} className={u.is_active ? '' : 'bg-gray-50 text-gray-400'}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{`${u.first_name} ${u.last_name}`.trim() || u.username}{isMe && ' (tú)'}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">{ROLE_LABELS[u.role] ?? u.role}</td>
                    <td className="px-4 py-3 text-xs">
                      {(u.branch_ids ?? []).length === 0 ? '—' : (u.branch_ids ?? []).map(branchName).join(', ')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                        {u.is_active ? 'Activo' : 'Desactivado'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editable && (
                        <button
                          type="button"
                          onClick={() => setPendingToggle(u)}
                          disabled={updateMutation.isPending}
                          className={`text-sm font-semibold cursor-pointer disabled:opacity-50 ${u.is_active ? 'text-red-600 hover:text-red-700' : 'text-blue-600 hover:text-blue-700'}`}
                        >
                          {u.is_active ? 'Desactivar' : 'Reactivar'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Nuevo usuario" maxWidth="max-w-lg">
        <NewUserForm onDone={() => setIsCreateOpen(false)} />
      </Modal>

      <ActionConfirmationModal
        isOpen={pendingToggle !== null}
        onClose={() => setPendingToggle(null)}
        onConfirm={() => {
          if (pendingToggle) {
            updateMutation.mutate({ path: { id: pendingToggle.id }, body: { is_active: !pendingToggle.is_active } });
          }
          setPendingToggle(null);
        }}
        title={pendingToggle?.is_active ? '¿Desactivar usuario?' : '¿Reactivar usuario?'}
        description={pendingToggle?.is_active
          ? `${pendingToggle.email} no podrá iniciar sesión y su sesión actual dejará de funcionar. Podrás reactivarlo después.`
          : `${pendingToggle?.email ?? ''} podrá volver a iniciar sesión.`}
        confirmText={pendingToggle?.is_active ? 'Sí, desactivar' : 'Sí, reactivar'}
        cancelText="Cancelar"
        variant={pendingToggle?.is_active ? 'danger' : 'warning'}
      />
    </div>
  );
}

function NewUserForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const { branches } = useBranch();
  const { register, handleSubmit, formState: { errors } } = useForm<NewUserValues>({
    resolver: zodResolver(newUserSchema),
    defaultValues: {
      first_name: '', last_name: '', username: '', email: '', password: '',
      branch_ids: branches.map((b) => b.id),
    },
  });

  const createMutation = useMutation({
    ...v1RegisterCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: v1CompanyUsersListQueryKey() });
      toast.success('Usuario creado');
      onDone();
    },
    onError: (error) => toast.error(firstApiError(error) ?? 'No se pudo crear el usuario'),
  });

  const field = 'block w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-blue-500';
  const text = (name: keyof Omit<NewUserValues, 'branch_ids'>, label: string, type = 'text') => (
    <div>
      <label htmlFor={`new-user-${name}`} className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input id={`new-user-${name}`} type={type} autoComplete="off" {...register(name)} className={field} />
      {errors[name] && <p className="mt-1 text-xs text-red-600">{errors[name]?.message}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit((values) => createMutation.mutate({ body: values }))} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {text('first_name', 'Nombre')}
        {text('last_name', 'Apellido')}
      </div>
      {text('username', 'Nombre de usuario')}
      {text('email', 'Correo electrónico', 'email')}
      {text('password', 'Contraseña', 'password')}
      <fieldset>
        <legend className="mb-1 block text-sm font-medium text-gray-700">Sucursales</legend>
        <div className="space-y-1">
          {branches.map((b) => (
            <label key={b.id} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" value={b.id} {...register('branch_ids')} className="h-4 w-4 rounded border-gray-300" />
              {b.name}
            </label>
          ))}
        </div>
        {errors.branch_ids && <p className="mt-1 text-xs text-red-600">{errors.branch_ids.message}</p>}
      </fieldset>
      <p className="text-xs text-gray-500">Se crea como empleado. Comparte la contraseña con la persona por un canal seguro.</p>
      <button
        type="submit"
        disabled={createMutation.isPending}
        className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
      >
        {createMutation.isPending ? 'Creando...' : 'Crear usuario'}
      </button>
    </form>
  );
}
