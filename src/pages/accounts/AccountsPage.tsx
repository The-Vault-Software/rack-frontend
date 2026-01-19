import { useState } from 'react';
import { ArrowUpCircle, ArrowDownCircle, History, PlusCircle } from 'lucide-react';
import CashFlow from './components/CashFlow';
import AccountsReceivable from './components/AccountsReceivable';
import AccountsPayable from './components/AccountsPayable';
import AccountBuilder from './components/AccountBuilder';
import MobileAccountBuilder from './components/MobileAccountBuilder';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { cn } from '../../lib/utils';

export default function AccountsPage() {
  const [activeTab, setActiveTab] = useState<'cashflow' | 'receivable' | 'payable' | 'new-account'>('new-account');
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <div className={cn("space-y-6", isMobile && "space-y-4 px-2")}>
      <div className="flex justify-between items-center">
        {!isMobile && <h1 className="text-2xl font-bold text-gray-900">Módulo de Cuentas</h1>}
      </div>

      {/* Tabs */}
      <div className={cn(
        "border-b border-gray-200",
        isMobile && "sticky top-0 bg-gray-50/80 backdrop-blur-md z-10 -mx-2 px-2 border-none overflow-x-auto scrollbar-hide"
      )}>
        <nav className={cn(
          "-mb-px flex",
          isMobile ? "space-x-4 min-w-max pb-1" : "space-x-8"
        )} aria-label="Tabs">
          <TabButton 
            active={activeTab === 'new-account'} 
            onClick={() => setActiveTab('new-account')}
            icon={<PlusCircle className={cn(activeTab === 'new-account' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500', "-ml-0.5 mr-2 h-5 w-5", isMobile && "h-4 w-4")} />}
            label="Nueva Compra"
            isMobile={isMobile}
          />
          <TabButton 
            active={activeTab === 'cashflow'} 
            onClick={() => setActiveTab('cashflow')}
            icon={<History className={cn(activeTab === 'cashflow' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500', "-ml-0.5 mr-2 h-5 w-5", isMobile && "h-4 w-4")} />}
            label="Flujo de Caja"
            isMobile={isMobile}
          />
          <TabButton 
            active={activeTab === 'receivable'} 
            onClick={() => setActiveTab('receivable')}
            icon={<ArrowDownCircle className={cn(activeTab === 'receivable' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500', "-ml-0.5 mr-2 h-5 w-5", isMobile && "h-4 w-4")} />}
            label="Por Cobrar"
            isMobile={isMobile}
          />
          <TabButton 
            active={activeTab === 'payable'} 
            onClick={() => setActiveTab('payable')}
            icon={<ArrowUpCircle className={cn(activeTab === 'payable' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500', "-ml-0.5 mr-2 h-5 w-5", isMobile && "h-4 w-4")} />}
            label="Por Pagar"
            isMobile={isMobile}
          />
        </nav>
      </div>

      {/* Content */}
      <div className={cn(
        "bg-white shadow overflow-visible sm:rounded-lg min-h-[400px]",
        isMobile && "bg-transparent shadow-none rounded-none"
      )}>
        {activeTab === 'new-account' && (isMobile ? <MobileAccountBuilder /> : <AccountBuilder />)}
        {activeTab === 'cashflow' && <CashFlow />}
        {activeTab === 'receivable' && <AccountsReceivable />}
        {activeTab === 'payable' && <AccountsPayable />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, isMobile }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, isMobile: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        active ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
        "group inline-flex items-center py-4 px-1 border-b-2 font-medium transition-colors duration-200",
        isMobile && "py-3 px-2"
      )}
    >
      {icon}
      <span className={isMobile ? "text-xs whitespace-nowrap" : "text-sm"}>{label}</span>
    </button>
  );
}
