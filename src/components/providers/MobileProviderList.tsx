
import React from 'react';
import { Edit2, Trash2, History, Truck, Phone, Mail, Fingerprint } from 'lucide-react';
import type { Provider } from '../../client/types.gen';

interface MobileProviderListProps {
  providers: Provider[];
  onEdit: (provider: Provider) => void;
  onDelete: (provider: Provider) => void;
  onViewHistory: (provider: Provider) => void;
}

const MobileProviderList: React.FC<MobileProviderListProps> = ({
  providers,
  onEdit,
  onDelete,
  onViewHistory,
}) => {
  if (providers.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 bg-white rounded-lg border border-gray-100 shadow-sm">
        No se encontraron proveedores.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-1">
      {providers.map((provider) => {
        return (
          <div key={provider.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform duration-200">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="shrink-0 h-12 w-12 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Truck className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-gray-900 truncate">{provider.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-md bg-gray-100 text-gray-600 border border-gray-200">
                      Proveedor
                    </span>
                    {provider.document && (
                      <div className="flex items-center text-xs text-gray-500">
                        <Fingerprint className="h-3 w-3 mr-1" />
                        {provider.document}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                  <Phone className="h-4 w-4 mr-3 text-gray-400 shrink-0" />
                  <span className="truncate">{provider.phone || 'Sin teléfono'}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                  <Mail className="h-4 w-4 mr-3 text-gray-400 shrink-0" />
                  <span className="truncate">{provider.email || 'Sin email'}</span>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => onViewHistory(provider)}
                  className="flex-1 flex items-center justify-center px-3 py-2 text-sm font-semibold text-amber-700 bg-amber-50 rounded-xl hover:bg-amber-100 active:bg-amber-200 transition-colors border border-amber-100"
                >
                  <History className="h-4 w-4 mr-2" />
                  Cuentas
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onEdit(provider)}
                    className="p-2.5 text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 active:bg-blue-200 transition-colors border border-blue-100"
                    aria-label="Editar"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(provider)}
                    className="p-2.5 text-red-600 bg-red-50 rounded-xl hover:bg-red-100 active:bg-red-200 transition-colors border border-red-100"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MobileProviderList;
