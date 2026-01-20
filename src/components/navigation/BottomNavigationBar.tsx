import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Package, Users, Settings, Wallet } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

export function BottomNavigationBar() {
  const location = useLocation();

  const navigation = [
    { name: 'Ventas', href: '/sales', icon: ShoppingCart },
    { name: 'Cuentas', href: '/accounts', icon: Wallet },
    { name: 'Inventario', href: '/inventory', icon: Package },
    { name: 'Contactos', href: '/contacts', icon: Users },
    { name: 'Configuración', href: '/settings', icon: Settings },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-gray-200 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
      <nav className="flex justify-around items-center h-[72px] px-1">
        {navigation.map((item) => {
          const isActive = location.pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              to={item.href}
              className="relative flex flex-col items-center justify-center w-full h-full touchscreen-target focus:outline-none cursor-pointer"
            >
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-active"
                  className="absolute top-0 h-1 w-10 bg-blue-600 rounded-b-lg shadow-[0_2px_12px_rgba(37,99,235,0.4)]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 transition-all duration-300",
                  isActive ? "text-blue-600 translate-y-1" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <item.icon
                  className={cn(
                    "h-6 w-6 transition-transform duration-300",
                    isActive ? "scale-110" : "scale-100"
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className={cn(
                  "text-[10px] font-semibold tracking-wide transition-opacity duration-300",
                  isActive ? "opacity-100" : "opacity-80"
                )}>
                  {item.name}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
