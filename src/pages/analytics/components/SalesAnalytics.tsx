import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { v1SalesListOptions } from '../../../client/@tanstack/react-query.gen';
import { useBranch } from '../../../context/BranchContext';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { 
  DollarSign, ShoppingBag, TrendingUp, Calendar, 
  ArrowUpRight, ArrowDownRight, RefreshCw, Layers
} from 'lucide-react';
import { format, parseISO, getDay } from 'date-fns';
import { es } from 'date-fns/locale';

const LIMIT_OPTIONS = [50, 100, 200, 500, 1000];

export default function SalesAnalytics() {
  const { selectedBranch } = useBranch();
  const [limit, setLimit] = useState(200);

  const { data, isLoading, isFetching, refetch } = useQuery({
    ...v1SalesListOptions({
      // @ts-expect-error - Query params might be slightly off in types but work
      query: { branch: selectedBranch?.id, page_size: limit }
    }),
    enabled: !!selectedBranch?.id,
  });

  const sales = useMemo(() => data?.results || [], [data?.results]);

  const analyticsData = useMemo(() => {
    if (sales.length === 0) return null;

    const sortedSales = [...sales].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    // KPI Calculations
    const totalRevenue = sales.reduce((acc, sale) => acc + parseFloat(sale.total_amount_usd || '0'), 0);
    const averageTicket = totalRevenue / sales.length;
    const totalSales = sales.length;
    
    // Grouping by Date
    const salesByDate: Record<string, number> = {};
    const salesByDayOfWeek: number[] = new Array(7).fill(0);
    
    sales.forEach(sale => {
      const date = format(parseISO(sale.created_at), 'yyyy-MM-dd');
      const amount = parseFloat(sale.total_amount_usd || '0');
      salesByDate[date] = (salesByDate[date] || 0) + amount;
      
      const dayOfWeek = getDay(parseISO(sale.created_at));
      salesByDayOfWeek[dayOfWeek] += amount;
    });

    // Main Chart Data (Timeline)
    const timelineData = Object.entries(salesByDate).map(([date, amount]) => ({
      date: format(parseISO(date), 'dd MMM', { locale: es }),
      amount,
      fullDate: date
    })).sort((a, b) => a.fullDate.localeCompare(b.fullDate));

    // Day of Week Chart Data
    const daysName = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const dayOfWeekData = salesByDayOfWeek.map((amount, index) => ({
      day: daysName[index],
      amount
    }));

    // Growth check (Comparing first half vs second half of the loaded sample as a proxy)
    const midIdx = Math.floor(sortedSales.length / 2);
    const firstHalf = sortedSales.slice(0, midIdx);
    const secondHalf = sortedSales.slice(midIdx);
    const firstHalfRev = firstHalf.reduce((acc, s) => acc + parseFloat(s.total_amount_usd || '0'), 0);
    const secondHalfRev = secondHalf.reduce((acc, s) => acc + parseFloat(s.total_amount_usd || '0'), 0);
    const growth = firstHalfRev > 0 ? ((secondHalfRev - firstHalfRev) / firstHalfRev) * 100 : 0;

    return {
      totalRevenue,
      averageTicket,
      totalSales,
      timelineData,
      dayOfWeekData,
      growth
    };
  }, [sales]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-gray-200 rounded-3xl"></div>
        ))}
        <div className="md:col-span-3 h-80 bg-gray-200 rounded-3xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
          <Layers className="h-4 w-4 text-blue-500" />
          <span>Analizando últimas</span>
          <select 
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {LIMIT_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <span>ventas</span>
        </div>
        
        <button 
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 text-gray-500 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {analyticsData && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard 
              title="Ingresos Totales" 
              value={`$${analyticsData.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={DollarSign}
              trend={analyticsData.growth}
              color="blue"
            />
            <StatCard 
              title="Ticket Promedio" 
              value={`$${analyticsData.averageTicket.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={TrendingUp}
              color="emerald"
            />
            <StatCard 
              title="Volumen de Ventas" 
              value={analyticsData.totalSales.toString()}
              icon={ShoppingBag}
              color="orange"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Area Chart */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Fluctuación de Ingresos</h3>
                  <p className="text-sm text-gray-500">Histórico basado en la muestra seleccionada</p>
                </div>
                <div className="bg-blue-50 p-2 rounded-xl">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData.timelineData}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontSize: 12}}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontSize: 12}}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number | string | undefined) => [`$${Number(value || 0).toFixed(2)}`, 'Ventas']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorAmount)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar Chart - Day of Week */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Ventas por Día</h3>
                  <p className="text-sm text-gray-500">Rendimiento semanal</p>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.dayOfWeekData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontSize: 12}}
                    />
                    <YAxis hide />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number | string | undefined) => [`$${Number(value || 0).toFixed(2)}`, 'Ventas']}
                    />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                      {analyticsData.dayOfWeekData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={analyticsData.dayOfWeekData[index].amount === Math.max(...analyticsData.dayOfWeekData.map(d => d.amount)) ? '#3b82f6' : '#e2e8f0'} />
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

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  trend?: number;
  color?: 'blue' | 'emerald' | 'orange';
}

function StatCard({ title, value, icon: Icon, trend, color }: StatCardProps) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-600'
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="flex justify-between items-start">
        <div className={`p-3 rounded-2xl ${colors[color || 'blue']}`}>
          <Icon className="h-6 w-6" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${trend >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <h4 className="text-2xl font-bold text-gray-900 mt-1">{value}</h4>
      </div>
    </div>
  );
}
