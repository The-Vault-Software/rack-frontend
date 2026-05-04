import { useState } from 'react';
import { ClipboardList, History, Plus } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { cn } from '../../lib/utils';
import Modal from '../../components/ui/Modal';
import AdjustmentForm from './components/AdjustmentForm';
import AdjustmentList from './components/AdjustmentList';

const tabButtonBaseClass = 'group inline-flex items-center py-4 px-1 border-b-2 font-medium transition-colors duration-200 cursor-pointer';
const tabButtonActiveClass = 'border-blue-500 text-blue-600';
const tabButtonInactiveClass = 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';

export default function InventoryAdjustmentsPage() {
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('history');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <div className={cn('space-y-6', isMobile && 'space-y-4 px-2')}>
      <div className="flex justify-between items-center">
        {!isMobile && <h1 className="text-2xl font-bold text-gray-900">Ajustes de Inventario</h1>}
        {!isMobile && (
          <button
            onClick={() => setIsFormModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Nuevo Ajuste
          </button>
        )}
      </div>

      <div className={cn(
        'border-b border-gray-200',
        isMobile && 'sticky top-0 bg-gray-50/80 backdrop-blur-md z-10 -mx-2 px-2 border-none'
      )}>
        <nav className={cn('-mb-px flex', isMobile ? 'justify-around w-full' : 'space-x-8')} aria-label="Tabs">
          <button
            onClick={() => setActiveTab('new')}
            className={cn(
              activeTab === 'new' ? tabButtonActiveClass : tabButtonInactiveClass,
              tabButtonBaseClass,
              isMobile && 'flex-1 justify-center py-3'
            )}
          >
            <ClipboardList className={cn(
              activeTab === 'new' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500',
              '-ml-0.5 mr-2 h-5 w-5',
              isMobile && 'h-4 w-4'
            )} />
            <span className={isMobile ? 'text-xs' : 'text-sm'}>Nuevo Ajuste</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              activeTab === 'history' ? tabButtonActiveClass : tabButtonInactiveClass,
              tabButtonBaseClass,
              isMobile && 'flex-1 justify-center py-3'
            )}
          >
            <History className={cn(
              activeTab === 'history' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500',
              '-ml-0.5 mr-2 h-5 w-5',
              isMobile && 'h-4 w-4'
            )} />
            <span className={isMobile ? 'text-xs' : 'text-sm'}>Historial</span>
          </button>
        </nav>
      </div>

      <div className={cn(
        'bg-white shadow-sm overflow-visible sm:rounded-lg min-h-[400px]',
        isMobile && 'bg-transparent shadow-none rounded-none'
      )}>
        {activeTab === 'new' && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="p-5 bg-blue-50 rounded-2xl mb-4">
              <ClipboardList className="h-10 w-10 text-blue-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Crear Ajuste de Inventario</h2>
            <p className="text-sm text-gray-500 max-w-sm mb-6">
              Registra ajustes manuales, cargas iniciales, correcciones por conteo, mermas y traslados entre sucursales.
            </p>
            <button
              onClick={() => setIsFormModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus className="h-5 w-5" />
              Crear Ajuste
            </button>
          </div>
        )}
        {activeTab === 'history' && <AdjustmentList />}
      </div>

      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title="Nuevo Ajuste de Inventario"
        maxWidth="max-w-2xl"
      >
        <AdjustmentForm onSuccess={() => setIsFormModalOpen(false)} />
      </Modal>
    </div>
  );
}
