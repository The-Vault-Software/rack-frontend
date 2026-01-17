import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { v1CustomersRetrieveOptions } from '../../client/@tanstack/react-query.gen';
import SalesHistory from '../sales/components/SalesHistory';
import { ArrowLeft, User } from 'lucide-react';

export default function CustomerSalesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: customer, isLoading } = useQuery({
    ...v1CustomersRetrieveOptions({
        path: { id: id! }
    }),
    enabled: !!id
  });

  if (!id) return <div>ID de cliente no proporcionado</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/contacts')}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="h-6 w-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <User className="h-6 w-6 text-blue-500" />
            Historial de Ventas
          </h1>
          {isLoading ? (
            <div className="h-5 w-48 bg-gray-200 animate-pulse rounded mt-1"></div>
          ) : (
            <p className="text-gray-500">
              Cliente: <span className="font-semibold text-gray-900">{customer?.name}</span>
            </p>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <SalesHistory customerId={id} />
      </div>
    </div>
  );
}
