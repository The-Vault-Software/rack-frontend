import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { branchListOptions, branchListQueryKey, branchCreateMutation, branchDestroyMutation, branchPartialUpdateMutation } from '../../client/@tanstack/react-query.gen';
import { Plus, Edit2, Trash2, MapPin, Phone, Mail, Store } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../../components/ui/Modal';
import ConfirmationDialog from '../../components/ui/ConfirmationDialog';
import type { Branch, BranchRequest } from '../../client/types.gen';
import { useForm } from 'react-hook-form';

interface BranchSettingsPageProps {
  hideHeader?: boolean;
}

export default function BranchSettingsPage({ hideHeader = false }: BranchSettingsPageProps) {
  const queryClient = useQueryClient();
  const { data: branches = [], isLoading } = useQuery(branchListOptions());
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const createMutation = useMutation({
    ...branchCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchListQueryKey() });
      toast.success('Sucursal creada correctamente');
      handleCloseModal();
    },
    onError: () => toast.error('Error al crear sucursal')
  });

  const updateMutation = useMutation({
    ...branchPartialUpdateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchListQueryKey() });
      toast.success('Sucursal actualizada correctamente');
      handleCloseModal();
    },
    onError: () => toast.error('Error al actualizar sucursal')
  });

  const deleteMutation = useMutation({
    ...branchDestroyMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchListQueryKey() });
      toast.success('Sucursal eliminada correctamente');
      setConfirmDelete(null);
    },
    onError: () => toast.error('Error al eliminar sucursal')
  });

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBranch(null);
  };

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BranchRequest>();

  const onSubmit = (data: BranchRequest) => {
    if (editingBranch) {
      updateMutation.mutate({ path: { id: editingBranch.id }, body: data });
    } else {
      createMutation.mutate({ body: data });
    }
  };

  // Reset form when editing changes
  useState(() => {
    if (editingBranch) {
      reset({
        name: editingBranch.name,
        address: editingBranch.address,
        phone: editingBranch.phone,
        email: editingBranch.email,
      });
    } else {
      reset({ name: '', address: '', phone: '', email: '' });
    }
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500">Cargando sucursales...</div>;

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sucursales</h1>
            <p className="text-sm text-gray-500">Gestiona las ubicaciones físicas de tu negocio</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva Sucursal
          </button>
        </div>
      )}

      {hideHeader && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva Sucursal
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((branch) => (
          <div key={branch.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-5">
              <div className="flex justify-between items-start">
                <div className="flex items-center">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Store className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="ml-3 text-lg font-semibold text-gray-900">{branch.name}</h3>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => handleEdit(branch)} className="text-gray-400 hover:text-blue-600">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => setConfirmDelete(branch.id)} className="text-gray-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="mt-4 space-y-2">
                {branch.address && (
                  <div className="flex items-center text-sm text-gray-500">
                    <MapPin className="h-4 w-4 mr-2 shrink-0" />
                    <span>{branch.address}</span>
                  </div>
                )}
                {branch.phone && (
                  <div className="flex items-center text-sm text-gray-500">
                    <Phone className="h-4 w-4 mr-2 shrink-0" />
                    <span>{branch.phone}</span>
                  </div>
                )}
                {branch.email && (
                  <div className="flex items-center text-sm text-gray-500">
                    <Mail className="h-4 w-4 mr-2 shrink-0" />
                    <span>{branch.email}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
              ID: {branch.id}
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingBranch ? 'Editar Sucursal' : 'Nueva Sucursal'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre</label>
            <input
              {...register('name', { required: 'El nombre es obligatorio' })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Ej. Sucursal Principal"
              defaultValue={editingBranch?.name}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Dirección</label>
            <textarea
              {...register('address')}
              rows={2}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Dirección física"
              defaultValue={editingBranch?.address || ''}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Teléfono</label>
              <input
                {...register('phone')}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Ej. +58 412..."
                defaultValue={editingBranch?.phone || ''}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                {...register('email')}
                type="email"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="sucursal@ejemplo.com"
                defaultValue={editingBranch?.email || ''}
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {editingBranch ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmationDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteMutation.mutate({ path: { id: confirmDelete } })}
        title="Eliminar Sucursal"
        description="¿Estás seguro de que deseas eliminar esta sucursal? Esta acción podría afectar a los registros asociados."
        confirmText="Eliminar"
        variant="danger"
      />
    </div>
  );
}
