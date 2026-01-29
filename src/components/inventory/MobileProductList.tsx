
import React from 'react';
import type { ProductMaster } from '../../client/types.gen';
import { Edit2, Trash2, AlertTriangle } from 'lucide-react';

interface MobileProductListProps {
  products: ProductMaster[];
  getCategoryName: (id?: string | null) => string;
  getUnitName: (id?: string | null) => string;
  getStock: (id: string) => string;
  rates: { bcv_rate: string; parallel_rate: string } | undefined;
  onEdit: (product: ProductMaster) => void;
  onDelete: (product: ProductMaster) => void;
}

const MobileProductList: React.FC<MobileProductListProps> = ({
  products,
  getCategoryName,
  getUnitName,
  getStock,
  rates,
  onEdit,
  onDelete,
}) => {
  if (products.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 bg-white rounded-lg shadow">
        No se encontraron productos.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {products.map((product) => {
        const basePrice = parseFloat(product.cost_price_usd) * (1 + parseFloat(product.profit_margin || '0') / 100);
        const finalPriceUsd = product.IVA ? basePrice * 1.16 : basePrice;
        
        return (
          <div key={product.id} className="bg-white rounded-lg shadow p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
                <p className="text-sm text-gray-500">{getCategoryName(product.category)}</p>
              </div>
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${product.IVA ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                {product.IVA ? 'IVA (16%)' : 'Exento'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="block text-gray-500 text-xs">Precio Venta (USD)</span>
                <span className="font-medium text-gray-900">${finalPriceUsd.toFixed(2)}</span>
              </div>
              <div>
                <span className="block text-gray-500 text-xs">Precio Venta (Bs)</span>
                <span className="font-medium text-gray-900">
                   {rates ? `Bs. ${(finalPriceUsd * parseFloat(rates.bcv_rate)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                </span>
              </div>
              <div>
                <span className="block text-gray-500 text-xs">Costo (USD)</span>
                <span className="text-gray-700">${product.cost_price_usd}</span>
              </div>
              <div>
                 <span className="block text-gray-500 text-xs">Stock</span>
                 <div className="flex items-center gap-1.5">
                    <span className={`font-bold ${parseFloat(getStock(product.id)) > 0 ? (parseFloat(getStock(product.id)) < 5 ? 'text-orange-600' : 'text-green-600') : 'text-red-600'}`}>
                       {getStock(product.id)} {getUnitName(product.measurement_unit)}
                    </span>
                    {parseFloat(getStock(product.id)) < 5 && (
                      <AlertTriangle className="h-4 w-4 text-orange-500 animate-pulse" />
                    )}
                 </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end gap-3">
              <button 
                onClick={() => onEdit(product)}
                className="flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                aria-label={`Editar ${product.name}`}
              >
                <Edit2 className="h-4 w-4 mr-1.5" />
                Editar
              </button>
              <button 
                onClick={() => onDelete(product)}
                className="flex items-center px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                aria-label={`Eliminar ${product.name}`}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Eliminar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MobileProductList;
