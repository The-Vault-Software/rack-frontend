import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { v1AdjustmentsListInfiniteOptions } from '../../../client/@tanstack/react-query.gen';
import { useBranch } from '../../../context/BranchContext';
import { useInView } from 'react-intersection-observer';
import { Eye, Calendar, Hash, Filter, Package } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import AdjustmentDetailModal from './AdjustmentDetailModal';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { InventoryAdjustmentList } from '../../../client/types.gen';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { cn } from '../../../lib/utils';

const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  INITIAL_LOAD: 'Carga inicial',
  MANUAL_INCREASE: 'Incremento manual',
  MANUAL_DECREASE: 'Decremento manual',
  COUNT_CORRECTION: 'Corrección por conteo',
  DAMAGE: 'Daño / merma',
  SAMPLE: 'Muestra',
  TRANSFER_IN: 'Entrada por traslado',
  TRANSFER_OUT: 'Salida por traslado',
};

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

export default function AdjustmentList() {
  const { selectedBranch } = useBranch();
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedAdjustmentId, setSelectedAdjustmentId] = useState<string | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { ref, inView } = useInView();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    ...v1AdjustmentsListInfiniteOptions(
      // @ts-expect-error - Query params support more than what types say
      { query: { branch_id: selectedBranch?.id, ...(typeFilter && { adjustment_type: typeFilter }) } }
    ),
    enabled: !!selectedBranch?.id,
    getNextPageParam: (lastPage) => {
      // @ts-expect-error - Backend response has links.next
      if (lastPage.links?.next) {
        // @ts-expect-error - Backend response has current_page
        return lastPage.current_page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  if (inView && hasNextPage && !isFetchingNextPage) {
    fetchNextPage();
  }

  const adjustments = data?.pages.flatMap((page) => page.results) ?? [];

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Cargando historial de ajustes...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <Filter className="h-4 w-4 text-gray-400 shrink-0" />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(ADJUSTMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {isMobile ? (
        <div className="space-y-3 px-2 pb-4">
          {adjustments.map((adj: InventoryAdjustmentList) => (
            <div key={adj.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 mr-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-black text-gray-400">#{adj.seq_number}</span>
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-bold',
                      TYPE_BADGE_COLORS[adj.adjustment_type] ?? 'bg-gray-100 text-gray-800'
                    )}>
                      {adj.adjustment_type_display}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 truncate">{adj.reason}</p>
                </div>
                <button
                  onClick={() => setSelectedAdjustmentId(adj.id)}
                  className="p-2 text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 transition-colors cursor-pointer shrink-0"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 border-t pt-2">
                <div className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  <span>{adj.item_count} producto{adj.item_count !== 1 ? 's' : ''}</span>
                </div>
                <span>{format(new Date(adj.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
              </div>
            </div>
          ))}
          {adjustments.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              No se encontraron ajustes de inventario.
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center space-x-1"><Hash className="h-3 w-3" /><span>Nro</span></div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Razón</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center space-x-1"><Package className="h-3 w-3" /><span>Productos</span></div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sucursal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center space-x-1"><Calendar className="h-3 w-3" /><span>Fecha</span></div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {adjustments.map((adj: InventoryAdjustmentList) => (
                <tr key={adj.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{adj.seq_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn(
                      'px-2 inline-flex text-xs leading-5 font-bold rounded-full',
                      TYPE_BADGE_COLORS[adj.adjustment_type] ?? 'bg-gray-100 text-gray-800'
                    )}>
                      {adj.adjustment_type_display}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{adj.reason}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {adj.item_count} producto{adj.item_count !== 1 ? 's' : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{adj.branch_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(adj.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setSelectedAdjustmentId(adj.id)}
                      className="text-blue-600 hover:text-blue-900 bg-blue-50 p-2 rounded-full transition-colors cursor-pointer"
                      title="Ver detalles"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {adjustments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No se encontraron ajustes de inventario en esta sucursal.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div ref={ref} className="py-4 flex justify-center">
        {isFetchingNextPage ? (
          <div className="text-gray-500 text-sm animate-pulse flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
            <span>Cargando más ajustes...</span>
          </div>
        ) : hasNextPage ? (
          <span className="text-transparent">Cargar más</span>
        ) : adjustments.length > 0 ? (
          <span className="text-gray-400 text-sm italic">No hay más ajustes para mostrar.</span>
        ) : null}
      </div>

      <Modal
        isOpen={!!selectedAdjustmentId}
        onClose={() => setSelectedAdjustmentId(null)}
        title="Detalle del Ajuste de Inventario"
        maxWidth="max-w-2xl"
      >
        {selectedAdjustmentId && <AdjustmentDetailModal adjustmentId={selectedAdjustmentId} />}
      </Modal>
    </div>
  );
}
