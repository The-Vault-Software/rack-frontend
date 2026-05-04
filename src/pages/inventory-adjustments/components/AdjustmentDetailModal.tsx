import { useQuery } from '@tanstack/react-query';
import { v1AdjustmentsRetrieveOptions } from '../../../client/@tanstack/react-query.gen';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Package, Calendar, User, FileText, ClipboardList } from 'lucide-react';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { cn } from '../../../lib/utils';

interface AdjustmentDetailModalProps {
  adjustmentId: string;
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  INITIAL_LOAD: 'bg-blue-100 text-blue-800',
  MANUAL_INCREASE: 'bg-green-100 text-green-800',
  TRANSFER_IN: 'bg-green-100 text-green-800',
  MANUAL_DECREASE: 'bg-red-100 text-red-800',
  DAMAGE: 'bg-red-100 text-red-800',
  SAMPLE: 'bg-orange-100 text-orange-800',
  TRANSFER_OUT: 'bg-red-100 text-red-800',
  COUNT_CORRECTION: 'bg-amber-100 text-amber-800',
};

export default function AdjustmentDetailModal({ adjustmentId }: AdjustmentDetailModalProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  const { data: adjustment, isLoading, error } = useQuery(
    v1AdjustmentsRetrieveOptions({ path: { id: adjustmentId } })
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="text-gray-500 text-sm animate-pulse">Cargando detalles del ajuste...</p>
      </div>
    );
  }

  if (error || !adjustment) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 font-medium">Error al cargar los detalles</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 p-4 rounded-2xl space-y-3">
          <div className="flex items-center text-sm text-gray-500">
            <ClipboardList className="h-4 w-4 mr-2" />
            <span className="font-bold uppercase tracking-widest text-[10px]">Información del Ajuste</span>
          </div>
          <div>
            <p className="text-lg font-black text-gray-900">Ajuste #{adjustment.seq_number}</p>
            <span className={cn(
              'mt-1 inline-flex px-2 py-0.5 rounded-full text-xs font-bold',
              TYPE_BADGE_COLORS[adjustment.adjustment_type] ?? 'bg-gray-100 text-gray-800'
            )}>
              {adjustment.adjustment_type_display}
            </span>
          </div>
          <div className="flex items-center text-xs text-gray-500 font-medium">
            <Calendar className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
            {format(new Date(adjustment.created_at), 'PPP p', { locale: es })}
          </div>
          <div className="flex items-center text-xs text-gray-500 font-medium">
            <User className="h-3.5 w-3.5 mr-1.5 text-purple-500" />
            {adjustment.created_by ?? '—'}
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-2xl space-y-3">
          <div className="flex items-center text-sm text-gray-500">
            <FileText className="h-4 w-4 mr-2" />
            <span className="font-bold uppercase tracking-widest text-[10px]">Razón / Notas</span>
          </div>
          <p className="text-sm font-semibold text-gray-900">{adjustment.reason}</p>
          {adjustment.notes && (
            <p className="text-xs text-gray-500 italic">{adjustment.notes}</p>
          )}
          <div className="flex items-center text-xs text-gray-500 font-medium">
            <Package className="h-3.5 w-3.5 mr-1.5 text-orange-500" />
            Sucursal: <span className="ml-1 font-bold text-gray-700">{adjustment.branch_name}</span>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center text-sm text-gray-500 mb-3 ml-1">
          <Package className="h-4 w-4 mr-2" />
          <span className="font-bold uppercase tracking-widest text-[10px]">Productos Ajustados</span>
        </div>

        {isMobile ? (
          <div className="space-y-3">
            {adjustment.details.map((item) => {
              const change = parseFloat(item.quantity_change);
              const isPositive = change >= 0;
              return (
                <div key={item.id} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{item.product_name}</p>
                      <p className="text-xs text-gray-400 font-mono">{item.product_sku}</p>
                    </div>
                    <span className={cn('text-sm font-black', isPositive ? 'text-green-600' : 'text-red-600')}>
                      {isPositive ? '+' : ''}{change.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 border-t pt-2">
                    <span>Antes: <strong>{parseFloat(item.quantity_before).toFixed(2)}</strong></span>
                    <span>Después: <strong>{parseFloat(item.quantity_after).toFixed(2)}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border rounded-lg overflow-x-auto shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Producto</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">SKU</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">Stock Antes</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">Cambio</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">Stock Después</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {adjustment.details.map((item) => {
                  const change = parseFloat(item.quantity_change);
                  const isPositive = change >= 0;
                  return (
                    <tr key={item.id} className="text-sm hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-4 font-semibold text-gray-900">{item.product_name}</td>
                      <td className="px-4 py-4 text-gray-500 font-mono text-xs">{item.product_sku}</td>
                      <td className="px-4 py-4 text-right text-gray-600">{parseFloat(item.quantity_before).toFixed(2)}</td>
                      <td className={cn('px-4 py-4 text-right font-bold', isPositive ? 'text-green-600' : 'text-red-600')}>
                        {isPositive ? '+' : ''}{change.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-right font-black text-gray-900">{parseFloat(item.quantity_after).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
