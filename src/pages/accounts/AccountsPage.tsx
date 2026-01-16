import { useState } from 'react';
import { ArrowUpCircle, ArrowDownCircle, History, PlusCircle } from 'lucide-react';
import CashFlow from './components/CashFlow';
import AccountsReceivable from './components/AccountsReceivable';
import AccountsPayable from './components/AccountsPayable';
import AccountBuilder from './components/AccountBuilder';

export default function AccountsPage() {
  const [activeTab, setActiveTab] = useState<'cashflow' | 'receivable' | 'payable' | 'new-account'>('new-account');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Módulo de Cuentas</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('new-account')}
            className={`${
              activeTab === 'new-account' ? tabButtonActiveClass : tabButtonInactiveClass
            } ${tabButtonBaseClass}`}
          >
            <PlusCircle className={`${activeTab === 'new-account' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'} -ml-0.5 mr-2 h-5 w-5`} />
            Nueva Compra
          </button>
          <button
            onClick={() => setActiveTab('cashflow')}
            className={`${
              activeTab === 'cashflow' ? tabButtonActiveClass : tabButtonInactiveClass
            } ${tabButtonBaseClass}`}
          >
            <History className={`${activeTab === 'cashflow' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'} -ml-0.5 mr-2 h-5 w-5`} />
            Flujo de Caja
          </button>
          <button
            onClick={() => setActiveTab('receivable')}
            className={`${
              activeTab === 'receivable' ? tabButtonActiveClass : tabButtonInactiveClass
            } ${tabButtonBaseClass}`}
          >
            <ArrowDownCircle className={`${activeTab === 'receivable' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'} -ml-0.5 mr-2 h-5 w-5`} />
            Cuentas por Cobrar
          </button>
          <button
            onClick={() => setActiveTab('payable')}
            className={`${
              activeTab === 'payable' ? tabButtonActiveClass : tabButtonInactiveClass
            } ${tabButtonBaseClass}`}
          >
            <ArrowUpCircle className={`${activeTab === 'payable' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'} -ml-0.5 mr-2 h-5 w-5`} />
            Cuentas por Pagar
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white shadow overflow-visible sm:rounded-lg min-h-[400px]">
        {activeTab === 'new-account' && <AccountBuilder />}
        {activeTab === 'cashflow' && <CashFlow />}
        {activeTab === 'receivable' && <AccountsReceivable />}
        {activeTab === 'payable' && <AccountsPayable />}
      </div>
    </div>
  );
}

const tabButtonBaseClass = "group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200";
const tabButtonActiveClass = "border-blue-500 text-blue-600";
const tabButtonInactiveClass = "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300";
