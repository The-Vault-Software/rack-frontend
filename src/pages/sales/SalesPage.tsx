import { useState } from 'react';
import { ShoppingBag, History } from 'lucide-react';
import SaleBuilder from './components/SaleBuilder';
import SalesHistory from './components/SalesHistory';

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Módulo de Ventas</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('pos')}
            className={`${
              activeTab === 'pos' ? tabButtonActiveClass : tabButtonInactiveClass
            } ${tabButtonBaseClass}`}
          >
            <ShoppingBag className={`${activeTab === 'pos' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'} -ml-0.5 mr-2 h-5 w-5`} />
            Nueva Venta
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`${
              activeTab === 'history' ? tabButtonActiveClass : tabButtonInactiveClass
            } ${tabButtonBaseClass}`}
          >
            <History className={`${activeTab === 'history' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'} -ml-0.5 mr-2 h-5 w-5`} />
            Historial de Ventas
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white shadow-sm overflow-visible sm:rounded-lg min-h-[400px]">
        {activeTab === 'pos' && <SaleBuilder />}
        {activeTab === 'history' && <SalesHistory />}
      </div>
    </div>
  );
}

const tabButtonBaseClass = "group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200";
const tabButtonActiveClass = "border-blue-500 text-blue-600";
const tabButtonInactiveClass = "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300";
