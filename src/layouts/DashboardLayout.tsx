import { Link, useLocation, useOutlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { LayoutDashboard, ShoppingCart, Package, Users, Settings, LogOut, Wallet, ChevronRight } from 'lucide-react';
import { BranchSelector } from '../components/BranchSelector';
import { motion, AnimatePresence } from 'motion/react';

export default function DashboardLayout() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const outlet = useOutlet();

  const navigation = [
    { name: 'Inicio', href: '/dashboard', icon: LayoutDashboard, color: 'text-blue-500' },
    { name: 'Ventas', href: '/sales', icon: ShoppingCart, color: 'text-emerald-500' },
    { name: 'Cuentas', href: '/accounts', icon: Wallet, color: 'text-indigo-500' },
    { name: 'Inventario', href: '/inventory', icon: Package, color: 'text-orange-500' },
    { name: 'Contactos', href: '/contacts', icon: Users, color: 'text-purple-500' },
    { name: 'Configuración', href: '/settings', icon: Settings, color: 'text-gray-500' },
  ];

  const activeNav = navigation.find(item => location.pathname.startsWith(item.href));
  const pageTitle = activeNav?.name || 'Dashboard';

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-72 md:flex-col relative z-20">
        <div className="flex flex-col grow bg-white border-r border-gray-100 pt-8 pb-6 overflow-y-auto shadow-sm">
          <div className="flex items-center shrink-0 px-8 mb-10">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-3"
            >
              <img src="/app_icon.png" alt="App Icon" className="h-10 w-10 rounded-xl object-cover" />
              <span className="text-2xl font-bold tracking-tight text-gray-900">Rack</span>
            </motion.div>
          </div>

          <nav className="mt-2 flex-1 px-4 space-y-2">
            {navigation.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className="relative group"
                >
                  <motion.div
                    initial={false}
                    animate={isActive ? "active" : "inactive"}
                    className={cn(
                      "relative flex items-center px-4 py-3.5 text-sm font-semibold rounded-2xl transition-colors duration-200",
                      isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-900"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-pill"
                        className="absolute inset-0 bg-blue-50/80 rounded-2xl z-0 border border-blue-100/50"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                    
                    <div className="relative z-10 flex items-center w-full">
                      <item.icon
                        className={cn(
                          "mr-3 shrink-0 h-5 w-5 transition-transform duration-200 group-hover:scale-110",
                          isActive ? item.color : "text-gray-400"
                        )}
                        aria-hidden="true"
                      />
                      <span className="flex-1">{item.name}</span>
                      {isActive && (
                        <motion.div
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                        >
                          <ChevronRight className="h-4 w-4 text-blue-400" />
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                </Link>
              );
            })}
          </nav>

          <div className="shrink-0 mt-auto px-4 pt-6">
            <div className="bg-gray-50 rounded-3xl p-4 border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-linear-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-600 font-bold">
                  {user?.first_name?.[0] || 'U'}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {user?.first_name || user?.last_name || 'Usuario'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => logout()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all duration-200 shadow-sm"
              >
                <LogOut className="h-4 w-4" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative">
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <motion.h1 
            key={pageTitle}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-xl font-bold text-gray-900"
          >
            {pageTitle}
          </motion.h1>
          <div className="flex items-center gap-4">
            <BranchSelector />
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto bg-transparent scroll-smooth">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {outlet}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
