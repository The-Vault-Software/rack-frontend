import { useState } from 'react';
import { ShoppingBag, History } from 'lucide-react';
import SaleBuilder from './components/SaleBuilder';
import MobileSaleBuilder from './components/MobileSaleBuilder';
import SalesHistory from './components/SalesHistory';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { cn } from '../../lib/utils';

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos');
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <div className={cn("space-y-6", isMobile && "space-y-4 px-2")}>
      <div className="flex justify-between items-center">
        {!isMobile && <h1 className="text-2xl font-bold text-gray-900">Módulo de Ventas</h1>}
      </div>

      {/* Tabs */}
      <div className={cn(
        "border-b border-gray-200",
        isMobile && "sticky top-0 bg-gray-50/80 backdrop-blur-md z-10 -mx-2 px-2 border-none"
      )}>
        <nav className={cn(
          "-mb-px flex",
          isMobile ? "justify-around w-full" : "space-x-8"
        )} aria-label="Tabs">
          <button
            onClick={() => setActiveTab('pos')}
            className={cn(
              activeTab === 'pos' ? tabButtonActiveClass : tabButtonInactiveClass,
              tabButtonBaseClass,
              isMobile && "flex-1 justify-center py-3"
            )}
          >
            <ShoppingBag className={cn(
              activeTab === 'pos' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500',
              "-ml-0.5 mr-2 h-5 w-5",
              isMobile && "h-4 w-4"
            )} />
            <span className={isMobile ? "text-xs" : "text-sm"}>Nueva Venta</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              activeTab === 'history' ? tabButtonActiveClass : tabButtonInactiveClass,
              tabButtonBaseClass,
              isMobile && "flex-1 justify-center py-3"
            )}
          >
            <History className={cn(
              activeTab === 'history' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500',
              "-ml-0.5 mr-2 h-5 w-5",
              isMobile && "h-4 w-4"
            )} />
            <span className={isMobile ? "text-xs" : "text-sm"}>Historial</span>
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className={cn(
        "bg-white shadow-sm overflow-visible sm:rounded-lg min-h-[400px]",
        isMobile && "bg-transparent shadow-none rounded-none"
      )}>
        {activeTab === 'pos' && (isMobile ? <MobileSaleBuilder /> : <SaleBuilder />)}
        {activeTab === 'history' && <SalesHistory />}
      </div>
    </div>
  );
}

const tabButtonBaseClass = "group inline-flex items-center py-4 px-1 border-b-2 font-medium transition-colors duration-200";
const tabButtonActiveClass = "border-blue-500 text-blue-600";
const tabButtonInactiveClass = "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300";
