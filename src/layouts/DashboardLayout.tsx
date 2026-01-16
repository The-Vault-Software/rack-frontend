import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { LayoutDashboard, ShoppingCart, Package, Users, Settings, LogOut, Wallet } from 'lucide-react';
import { BranchSelector } from '../components/BranchSelector';

export default function DashboardLayout() {
  const { logout, user } = useAuth();
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Ventas', href: '/sales', icon: ShoppingCart },
    { name: 'Cuentas', href: '/accounts', icon: Wallet },
    { name: 'Inventario', href: '/inventory', icon: Package },
    { name: 'Contactos', href: '/contacts', icon: Users },
    { name: 'Configuración', href: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex flex-col grow bg-white border-r pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center shrink-0 px-4 mb-5">
            <span className="text-xl font-bold text-gray-800">Rack</span>
          </div>
          <div className="mt-5 grow flex flex-col">
            <nav className="flex-1 px-2 space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                      'group flex items-center px-2 py-2 text-sm font-medium rounded-md'
                    )}
                  >
                    <item.icon
                      className={cn(
                        isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500',
                        'mr-3 shrink-0 h-6 w-6'
                      )}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="shrink-0 flex border-t border-gray-200 p-4">
            <div className="shrink-0 w-full group block">
              <div className="flex items-center">
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    {user?.first_name || user?.last_name || 'Usuario'}
                  </p>
                  <button
                    onClick={() => logout()}
                    className="flex items-center text-xs font-medium text-gray-500 group-hover:text-red-500 mt-1"
                  >
                    <LogOut className="mr-1 h-3 w-3" />
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-800">
            {navigation.find(item => location.pathname.startsWith(item.href))?.name || 'Dashboard'}
          </h1>
          <BranchSelector />
        </header>
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
