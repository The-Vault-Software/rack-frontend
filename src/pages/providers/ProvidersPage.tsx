import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { 
  providersListOptions, 
  providersListQueryKey, 
  providersDestroyMutation 
} from '../../client/@tanstack/react-query.gen';
import type { Provider } from '../../client/types.gen';
import ProviderForm from '../../components/providers/ProviderForm';
import ConfirmationDialog from '../../components/ui/ConfirmationDialog';
import Modal from '../../components/ui/Modal';

export default function ProvidersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    provider: Provider | null;
  }>({
    isOpen: false,
    provider: null,
  });

  const queryClient = useQueryClient();
  const { data: providersData, isLoading } = useQuery(providersListOptions());

  const deleteMutation = useMutation({
    ...providersDestroyMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: providersListQueryKey() });
      toast.success('Proveedor eliminado correctamente');
      setConfirmState({ isOpen: false, provider: null });
    },
    onError: () => toast.error('Error al eliminar el proveedor')
  });

  const filteredProviders = useMemo(() => {
    const providers = Array.isArray(providersData) ? providersData : [];
    return providers.filter(provider => {
      const matchesSearch = 
        provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (provider.document?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      
      return matchesSearch;
    });
  }, [providersData, searchTerm]);

  const handleEdit = (provider: Provider) => {
    setEditingProvider(provider);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingProvider(null);
    setIsModalOpen(true);
  };

  const handleDelete = (provider: Provider) => {
    setConfirmState({ isOpen: true, provider });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Directorio de Proveedores</h1>
        <button
          onClick={handleCreate}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Proveedor
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Buscar por nombre o identificación..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Cargando proveedores...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Identificación</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProviders.map((provider) => {
                  return (
                    <tr key={provider.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-green-100 text-green-600">
                            <Truck className="h-5 w-5" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{provider.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          {provider.document || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{provider.phone || 'Sin teléfono'}</div>
                        <div className="text-sm text-gray-500">{provider.email || 'Sin email'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => handleEdit(provider)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(provider)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredProviders.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      No se encontraron proveedores que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProvider ? 'Editar Proveedor' : 'Nuevo Proveedor'}
      >
        <ProviderForm 
          initialData={editingProvider} 
          onSuccess={() => setIsModalOpen(false)} 
        />
      </Modal>

      <ConfirmationDialog
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState({ isOpen: false, provider: null })}
        onConfirm={() => confirmState.provider && deleteMutation.mutate({ path: { id: confirmState.provider.id } })}
        title="Eliminar Proveedor"
        description={`¿Estás seguro de que deseas eliminar a "${confirmState.provider?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
      />
    </div>
  );
}
