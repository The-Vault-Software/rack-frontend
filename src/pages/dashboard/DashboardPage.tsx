import { useQuery } from '@tanstack/react-query';
import { companyRetrieveOptions } from '../../client/@tanstack/react-query.gen';
import { Wallet, ShoppingCart, Package, Users, ArrowRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

const shortcuts = [
  {
    name: 'Cuentas',
    description: 'Gestión de cobros, pagos y estados de cuenta.',
    href: '/accounts',
    icon: Wallet,
    color: 'from-blue-500 to-indigo-600',
    shadow: 'shadow-blue-200',
  },
  {
    name: 'Ventas',
    description: 'Registro de ventas y facturación rápida.',
    href: '/sales',
    icon: ShoppingCart,
    color: 'from-emerald-400 to-teal-600',
    shadow: 'shadow-emerald-200',
  },
  {
    name: 'Inventario',
    description: 'Control de stock, precios y movimientos.',
    href: '/inventory',
    icon: Package,
    color: 'from-orange-400 to-amber-600',
    shadow: 'shadow-orange-200',
  },
  {
    name: 'Clientes',
    description: 'Administración de clientes y proveedores.',
    href: '/contacts',
    icon: Users,
    color: 'from-purple-500 to-fuchsia-600',
    shadow: 'shadow-purple-200',
  },
];

export default function DashboardPage() {
  const { data: company, isLoading: loadingCompany } = useQuery(companyRetrieveOptions({}));

  if (loadingCompany) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <header className="mb-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            ¡Hola, bienvenido!
          </h1>
          <p className="mt-4 text-xl text-gray-500">
            ¿Qué deseas hacer hoy en <span className="text-blue-600 font-semibold">{company?.name || 'Tu Negocio'}</span>?
          </p>
        </motion.div>
      </header>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-2 xl:gap-10">
        {shortcuts.map((shortcut, index) => (
          <motion.div
            key={shortcut.name}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Link
              to={shortcut.href}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-white p-8 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-1 border border-gray-100 h-full`}
            >
              <div className="flex items-start justify-between">
                <div className={`rounded-2xl bg-linear-to-br ${shortcut.color} p-4 text-white shadow-lg ${shortcut.shadow} group-hover:scale-110 transition-transform duration-300`}>
                  <shortcut.icon className="h-8 w-8" />
                </div>
                <ArrowRight className="h-6 w-6 text-gray-300 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" />
              </div>
              
              <div className="mt-8">
                <h3 className="text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {shortcut.name}
                </h3>
                <p className="mt-2 text-lg text-gray-500 leading-relaxed">
                  {shortcut.description}
                </p>
              </div>

              {/* Decorative element */}
              <div className={`absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-linear-to-br ${shortcut.color} opacity-5 group-hover:opacity-10 transition-opacity`} />
            </Link>
          </motion.div>
        ))}
      </div>

      <footer className="mt-16 text-center text-gray-400">
        <p className="text-sm">
          Moisés David Jiménez Ortiz / The Vault Software &copy; {new Date().getFullYear()} - Gestión inteligente para tu negocio
        </p>
      </footer>
    </div>
  );
}
