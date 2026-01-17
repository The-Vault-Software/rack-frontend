import { useState } from 'react';
import { TrendingUp, Wallet2, Package } from 'lucide-react';
import SalesAnalytics from './components/SalesAnalytics';
import AccountsAnalytics from './components/AccountsAnalytics';
import InventoryAnalytics from './components/InventoryAnalytics';
import { motion, AnimatePresence } from 'framer-motion';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'sales' | 'accounts' | 'inventory'>('sales');

  return (
    <div className="space-y-8">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Centro de Analíticas</h2>
          <p className="text-gray-500 mt-1">Monitorea el rendimiento y salud financiera de tu negocio.</p>
        </div>

        <div className="flex bg-gray-100/80 p-1 rounded-2xl border border-gray-200/50 backdrop-blur-sm overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('sales')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${
              activeTab === 'sales'
                ? 'bg-white text-blue-600 shadow-sm border border-gray-100 ring-4 ring-blue-50/30'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
            }`}
          >
            <TrendingUp className={`h-4 w-4 ${activeTab === 'sales' ? 'text-blue-500' : ''}`} />
            Ventas
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${
              activeTab === 'accounts'
                ? 'bg-white text-indigo-600 shadow-sm border border-gray-100 ring-4 ring-indigo-50/30'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
            }`}
          >
            <Wallet2 className={`h-4 w-4 ${activeTab === 'accounts' ? 'text-indigo-500' : ''}`} />
            Cuentas
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${
              activeTab === 'inventory'
                ? 'bg-white text-orange-600 shadow-sm border border-gray-100 ring-4 ring-orange-50/30'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
            }`}
          >
            <Package className={`h-4 w-4 ${activeTab === 'inventory' ? 'text-orange-500' : ''}`} />
            Inventario
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {activeTab === 'sales' && <SalesAnalytics />}
          {activeTab === 'accounts' && <AccountsAnalytics />}
          {activeTab === 'inventory' && <InventoryAnalytics />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
