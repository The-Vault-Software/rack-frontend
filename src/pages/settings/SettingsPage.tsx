import { useState } from 'react';
import { Store, UserCircle } from 'lucide-react';
import BranchSettingsPage from './BranchSettingsPage';
import UserProfileForm from './UserProfileForm';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'branches' | 'profile'>('branches');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500">Administra las preferencias de tu cuenta y negocio</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('branches')}
            className={`${
              activeTab === 'branches'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm cursor-pointer`}
          >
            <Store
              className={`${
                activeTab === 'branches' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
              } -ml-0.5 mr-2 h-5 w-5`}
            />
            Sucursales
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`${
              activeTab === 'profile'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm cursor-pointer`}
          >
            <UserCircle
              className={`${
                activeTab === 'profile' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
              } -ml-0.5 mr-2 h-5 w-5`}
            />
            Perfil de Usuario
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="mt-6">
        {activeTab === 'branches' ? (
          <BranchSettingsPage hideHeader />
        ) : (
          <UserProfileForm />
        )}
      </div>
    </div>
  );
}
