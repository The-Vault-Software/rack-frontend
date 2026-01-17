import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Trash2, User, Building2, Filter, Truck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { 
  v1CustomersListOptions, 
  v1CustomersListQueryKey, 
  v1CustomersDestroyMutation,
  v1ProvidersListOptions, 
  v1ProvidersListQueryKey, 
  v1ProvidersDestroyMutation 
} from '../../client/@tanstack/react-query.gen';
import type { Customer, Provider } from '../../client/types.gen';
import CustomerForm from '../../components/customers/CustomerForm';
import ProviderForm from '../../components/providers/ProviderForm';
import ConfirmationDialog from '../../components/ui/ConfirmationDialog';
import Modal from '../../components/ui/Modal';
import { cn } from '../../lib/utils';

export default function ContactsPage() {
  const [activeTab, setActiveTab] = useState<'customers' | 'providers'>('customers');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'person' | 'company'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Customer | Provider | null>(null);
  
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    item: Customer | Provider | null;
    type: 'customer' | 'provider' | null;
  }>({
    isOpen: false,
    item: null,
    type: null,
  });

  const queryClient = useQueryClient();

  // Queries
  const { data: customersData, isLoading: isCustomersLoading } = useQuery(v1CustomersListOptions());
  const { data: providersData, isLoading: isProvidersLoading } = useQuery(v1ProvidersListOptions());

  // Mutations
  const deleteCustomerMutation = useMutation({
    ...v1CustomersDestroyMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: v1CustomersListQueryKey() });
      toast.success('Cliente eliminado correctamente');
      closeConfirm();
    },
    onError: () => toast.error('Error al eliminar el cliente')
  });

  const deleteProviderMutation = useMutation({
    ...v1ProvidersDestroyMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: v1ProvidersListQueryKey() });
      toast.success('Proveedor eliminado correctamente');
      closeConfirm();
    },
    onError: () => toast.error('Error al eliminar el proveedor')
  });

  const filteredCustomers = useMemo(() => {
    const customers = Array.isArray(customersData) ? customersData : [];
    return customers.filter(customer => {
      const matchesSearch = 
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.document?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      
      const isCompanyHeuristic = customer.document?.toUpperCase().startsWith('J') || customer.document?.toUpperCase().startsWith('G');
      const matchesType = 
        filterType === 'all' || 
        (filterType === 'person' && !isCompanyHeuristic) || 
        (filterType === 'company' && isCompanyHeuristic);

      return matchesSearch && matchesType;
    });
  }, [customersData, searchTerm, filterType]);

  const filteredProviders = useMemo(() => {
    const providers = Array.isArray(providersData) ? providersData : [];
    return providers.filter(provider => {
      const matchesSearch = 
        provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (provider.document?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      
      return matchesSearch;
    });
  }, [providersData, searchTerm]);

  const handleEdit = (item: Customer | Provider) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleDelete = (item: Customer | Provider, type: 'customer' | 'provider') => {
    setConfirmState({ isOpen: true, item, type });
  };

  const closeConfirm = () => {
    setConfirmState({ isOpen: false, item: null, type: null });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Directorio de Contactos</h1>
        <button
          onClick={handleCreate}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all active:scale-95"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo {activeTab === 'customers' ? 'Cliente' : 'Proveedor'}
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
            placeholder={`Buscar en ${activeTab === 'customers' ? 'clientes' : 'proveedores'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {activeTab === 'customers' && (
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'person' | 'company')}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border"
            >
              <option value="all">Todos los tipos</option>
              <option value="person">Persona Natural</option>
              <option value="company">Empresa / Jurídico</option>
            </select>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => { setActiveTab('customers'); setSearchTerm(''); setFilterType('all'); }}
            className={cn(
              "group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors",
              activeTab === 'customers' 
                ? "border-blue-500 text-blue-600" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}
          >
            <Users className={cn(
              "mr-2 h-5 w-5",
              activeTab === 'customers' ? "text-blue-500" : "text-gray-400 group-hover:text-gray-500"
            )} />
            Clientes
          </button>
          <button
            onClick={() => { setActiveTab('providers'); setSearchTerm(''); setFilterType('all'); }}
            className={cn(
              "group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors",
              activeTab === 'providers' 
                ? "border-blue-500 text-blue-600" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}
          >
            <Truck className={cn(
              "mr-2 h-5 w-5",
              activeTab === 'providers' ? "text-blue-500" : "text-gray-400 group-hover:text-gray-500"
            )} />
            Proveedores
          </button>
        </nav>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        {activeTab === 'customers' ? (
          isCustomersLoading ? (
            <div className="p-8 text-center text-gray-500">Cargando clientes...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Identificación</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
                    <th className="relative px-6 py-3">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCustomers.map((customer) => {
                    const isCompany = customer.document?.toUpperCase().startsWith('J') || customer.document?.toUpperCase().startsWith('G');
                    return (
                      <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-blue-100 text-blue-600">
                              {isCompany ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                              <div className="text-sm text-gray-500">{isCompany ? 'Empresa' : 'Persona'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            {customer.document || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{customer.phone || 'Sin teléfono'}</div>
                          <div className="text-sm text-gray-500">{customer.email || 'Sin email'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button 
                            onClick={() => handleEdit(customer)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(customer, 'customer')}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCustomers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                        No se encontraron clientes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )
        ) : (
          isProvidersLoading ? (
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
                            onClick={() => handleDelete(provider, 'provider')}
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
                        No se encontraron proveedores.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          activeTab === 'customers' 
            ? (editingItem ? 'Editar Cliente' : 'Nuevo Cliente') 
            : (editingItem ? 'Editar Proveedor' : 'Nuevo Proveedor')
        }
      >
        {activeTab === 'customers' ? (
          <CustomerForm 
            initialData={editingItem as Customer} 
            onSuccess={() => setIsModalOpen(false)} 
          />
        ) : (
          <ProviderForm 
            initialData={editingItem as Provider} 
            onSuccess={() => setIsModalOpen(false)} 
          />
        )}
      </Modal>

      <ConfirmationDialog
        isOpen={confirmState.isOpen}
        onClose={closeConfirm}
        onConfirm={() => {
          if (confirmState.type === 'customer' && confirmState.item) {
            deleteCustomerMutation.mutate({ path: { id: confirmState.item.id } });
          } else if (confirmState.type === 'provider' && confirmState.item) {
            deleteProviderMutation.mutate({ path: { id: confirmState.item.id } });
          }
        }}
        title={`Eliminar ${confirmState.type === 'customer' ? 'Cliente' : 'Proveedor'}`}
        description={`¿Estás seguro de que deseas eliminar a "${confirmState.item?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
      />
    </div>
  );
}
