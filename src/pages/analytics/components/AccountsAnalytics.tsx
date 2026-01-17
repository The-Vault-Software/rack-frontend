import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { v1SalesListOptions, v1AccountsListOptions } from '../../../client/@tanstack/react-query.gen';
import { useBranch } from '../../../context/BranchContext';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { 
  Receipt, 
  ArrowDownCircle, ArrowUpCircle, RefreshCw
} from 'lucide-react';

const COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981'];

export default function AccountsAnalytics() {
  const { selectedBranch } = useBranch();
  const [limit, setLimit] = useState(200);

  // Fetch Sales (for Accounts Receivable)
  const { data: salesData, isLoading: salesLoading, isFetching: salesFetching, refetch: refetchSales } = useQuery({
    ...v1SalesListOptions({
      // @ts-expect-error - Query params support
      query: { branch: selectedBranch?.id, page_size: limit }
    }),
    enabled: !!selectedBranch?.id,
  });

  // Fetch Accounts (for Accounts Payable)
  const { data: accountsData, isLoading: accountsLoading, isFetching: accountsFetching, refetch: refetchAccounts } = useQuery({
    ...v1AccountsListOptions({
      // @ts-expect-error - Query params support
      query: { branch: selectedBranch?.id, page_size: limit }
    }),
    enabled: !!selectedBranch?.id,
  });

  const sales = useMemo(() => salesData?.results || [], [salesData?.results]);
  const accounts = useMemo(() => accountsData?.results || [], [accountsData?.results]);

  const analyticsData = useMemo(() => {
    if (sales.length === 0 && accounts.length === 0) return null;

    // Accounts Receivable (Cuentas por Cobrar)
    const receivableTotal = sales.reduce((acc, sale) => {
      const pending = parseFloat(sale.total_amount_usd || '0') - parseFloat(sale.total_paid || '0');
      return acc + (pending > 0 ? pending : 0);
    }, 0);

    // Accounts Payable (Cuentas por Pagar)
    const payableTotal = accounts.reduce((acc, account) => {
      const pending = parseFloat(account.total_amount_usd || '0') - parseFloat(account.total_paid || '0');
      return acc + (pending > 0 ? pending : 0);
    }, 0);

    // Status Distribution - Sales
    const salesStatus = {
      'PAID': sales.filter(s => s.payment_status === 'PAID').length,
      'PARTIALLY_PAID': sales.filter(s => s.payment_status === 'PARTIALLY_PAID').length,
      'PENDING': sales.filter(s => s.payment_status === 'PENDING').length,
    };

    const pieData = [
      { name: 'Pagado', value: salesStatus.PAID },
      { name: 'Parcial', value: salesStatus.PARTIALLY_PAID },
      { name: 'Pendiente', value: salesStatus.PENDING },
    ].filter(d => d.value > 0);

    // Comparison Data (Receivable vs Payable)
    const comparisonData = [
      { name: 'Por Cobrar', amount: receivableTotal, color: '#3b82f6' },
      { name: 'Por Pagar', amount: payableTotal, color: '#ef4444' },
    ];

    return {
      receivableTotal,
      payableTotal,
      pieData,
      comparisonData,
      countReceivable: sales.filter(s => s.payment_status !== 'PAID').length,
      countPayable: accounts.filter(a => a.payment_status !== 'PAID').length,
    };
  }, [sales, accounts]);

  const isLoading = salesLoading || accountsLoading;
  const isFetching = salesFetching || accountsFetching;

  const refetchAll = () => {
    refetchSales();
    refetchAccounts();
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
        <div className="h-32 bg-gray-200 rounded-3xl"></div>
        <div className="h-32 bg-gray-200 rounded-3xl"></div>
        <div className="md:col-span-2 h-80 bg-gray-200 rounded-3xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
          <Receipt className="h-4 w-4 text-indigo-500" />
          <span>Analizando últimas</span>
          <select 
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="bg-indigo-50/50 border border-indigo-100 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-indigo-700 font-bold"
          >
            {[50, 100, 200, 500].map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <span>registros</span>
        </div>
        
        <button 
          onClick={refetchAll}
          disabled={isFetching}
          className="p-2 hover:bg-indigo-50 rounded-xl transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 text-indigo-400 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {analyticsData && (
        <>
          {/* Main Balance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <BalanceCard 
              title="Cuentas por Cobrar"
              subtitle={`${analyticsData.countReceivable} pendientes`}
              amount={analyticsData.receivableTotal}
              icon={ArrowDownCircle}
              variant="blue"
            />
            <BalanceCard 
              title="Cuentas por Pagar"
              subtitle={`${analyticsData.countPayable} pendientes`}
              amount={analyticsData.payableTotal}
              icon={ArrowUpCircle}
              variant="red"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart: Payment Status */}
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900">Estado de Pagos</h3>
                <p className="text-sm text-gray-500">Distribución de estados en la muestra</p>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analyticsData.pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={100}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {analyticsData.pieData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar Chart: Balance Comparison */}
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm transition-all hover:shadow-lg">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900">Balance de Deuda</h3>
                <p className="text-sm text-gray-500">Comparativa Receivable vs Payable</p>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.comparisonData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 600}} />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number | string | undefined) => [`$${Number(value || 0).toFixed(2)}`, 'Balance']}
                    />
                    <Bar dataKey="amount" radius={[0, 10, 10, 0]} barSize={40}>
                      {analyticsData.comparisonData.map((entry, index) => (
                        <Cell key={`cell कंप-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface BalanceCardProps {
  title: string;
  subtitle: string;
  amount: number;
  icon: React.ElementType;
  variant: 'blue' | 'red';
}

function BalanceCard({ title, subtitle, amount, icon: Icon, variant }: BalanceCardProps) {
  const styles = {
    blue: {
      bg: 'bg-blue-50/50',
      iconBg: 'bg-blue-600',
      text: 'text-blue-600',
      border: 'border-blue-100/50'
    },
    red: {
      bg: 'bg-rose-50/50',
      iconBg: 'bg-rose-600',
      text: 'text-rose-600',
      border: 'border-rose-100/50'
    }
  }[variant as 'blue' | 'red'];

  return (
    <div className={`relative overflow-hidden group p-8 rounded-[2.5rem] border ${styles.border} ${styles.bg} transition-all duration-500 hover:scale-[1.02] hover:shadow-xl`}>
      <div className="relative z-10 flex items-center gap-6">
        <div className={`p-5 rounded-2xl shadow-lg shadow-black/5 ${styles.iconBg}`}>
          <Icon className="h-8 w-8 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">{title}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h4 className="text-4xl font-extrabold text-gray-900 tracking-tight">
              ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h4>
          </div>
          <p className={`text-sm font-semibold mt-2 ${styles.text}`}>
            {subtitle}
          </p>
        </div>
      </div>
      
      {/* Decorative background circle */}
      <div className={`absolute -right-12 -top-12 w-48 h-48 rounded-full ${styles.text} opacity-[0.03] group-hover:scale-150 transition-transform duration-700 bg-current`} />
    </div>
  );
}
