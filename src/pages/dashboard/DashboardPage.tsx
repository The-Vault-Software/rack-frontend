import { useQuery } from '@tanstack/react-query';
import { companyRetrieveOptions, productListOptions } from '../../client/@tanstack/react-query.gen';
import { Button } from '../../components/ui/Button';
import { Loader2, Package, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { data: company, isLoading: loadingCompany } = useQuery(companyRetrieveOptions({}));
  const { data: products, isLoading: loadingProducts } = useQuery(productListOptions({}));

  if (loadingCompany || loadingProducts) {
    return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
    );
  }
// ...

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
           <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
           <p className="text-gray-500">
             Bienvenido a {company?.name || 'Tu Compañía'}
           </p>
        </div>
        <div>
           <Link to="/sales/new">
             <Button className="gap-2">
               <ShoppingCart className="h-4 w-4" />
               Nueva Venta
             </Button>
           </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
         {/* Stats Cards could go here */}
      </div>

      <div className="rounded-md border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4 flex justify-between items-center">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Últimos Productos
            </h3>
            <span className="text-xs text-gray-500">{products?.length || 0} productos</span>
        </div>
        <div className="divide-y">
            {products && products.length > 0 ? (
                products.slice(0, 5).map((product) => (
                    <div key={product.id} className="flex items-center justify-between px-6 py-4">
                        <div>
                            <p className="font-medium text-gray-900">{product.name}</p>
                            <p className="text-sm text-gray-500">{product.description || 'Sin descripción'}</p>
                        </div>
                        <div className="text-right">
                            <p className="font-medium text-gray-900">${product.cost_price_usd}</p>
                            <p className="text-xs text-gray-500">Costo</p>
                        </div>
                    </div>
                ))
            ) : (
                <div className="px-6 py-4 text-center text-gray-500">
                    No hay productos registrados.
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
