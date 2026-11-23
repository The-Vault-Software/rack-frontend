import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Package, Info, AlertTriangle, Play, Loader2, TrendingUp, History, DollarSign,
  BarChart2, Target, Anchor, Download, Hourglass, Tags,
} from 'lucide-react';
import { v1InventoryAnalysisRetrieveOptions } from '../../../client/@tanstack/react-query.gen';
import type { ProductAnalysisOut } from '../../../client/types.gen';
import { useBranch } from '../../../context/BranchContext';
import { exportInventoryAnalysis } from '../../../utils/inventoryAnalysisExport';
import PriceSuggestions from './PriceSuggestions';

const money = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const WINDOW_OPTIONS = [30, 60, 90, 180, 365];
const HORIZON_OPTIONS = [15, 30, 60, 90];

export default function InventoryAnalytics() {
  const { selectedBranch } = useBranch();
  const [windowDays, setWindowDays] = useState(90);
  const [horizonDays, setHorizonDays] = useState(60);
  // The analysis runs on demand, not on mount: it reads the whole sales
  // window of the branch, so it should not fire every time the tab opens.
  const [started, setStarted] = useState(false);

  // Everything is computed on the server from the full history, in a fixed
  // number of queries. This replaces fetching the last 100 sales one by one
  // and passing a `branch` filter the stock endpoint ignored (it reads
  // `branch_id`), which always analysed the user's first branch.
  const analysisQuery = useQuery({
    ...v1InventoryAnalysisRetrieveOptions({
      query: { branch_id: selectedBranch?.id ?? '', window_days: windowDays, horizon_days: horizonDays },
    }),
    enabled: started && !!selectedBranch,
    staleTime: 5 * 60 * 1000,
    // Keep showing the previous result while a new window or horizon
    // recalculates, instead of blanking the page behind a loader.
    placeholderData: (previous) => previous,
  });
  const analysis = analysisQuery.data;

  const controls = (
    <div className="flex flex-wrap items-end gap-4">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
        Historial
        <select
          value={windowDays}
          onChange={(e) => setWindowDays(Number(e.target.value))}
          className="mt-1 block rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 normal-case"
        >
          {WINDOW_OPTIONS.map((d) => <option key={d} value={d}>Últimos {d} días</option>)}
        </select>
      </label>
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
        Horizonte de precios
        <select
          value={horizonDays}
          onChange={(e) => setHorizonDays(Number(e.target.value))}
          className="mt-1 block rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 normal-case"
        >
          {HORIZON_OPTIONS.map((d) => <option key={d} value={d}>{d} días</option>)}
        </select>
      </label>
    </div>
  );

  if (!started || (!analysis && !analysisQuery.isFetching)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[3rem] border border-dashed border-gray-200 shadow-sm">
        <div className="bg-orange-50 p-6 rounded-full mb-6">
          <History className="h-12 w-12 text-orange-500" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Análisis de Inventario y Precios</h3>
        <p className="text-gray-500 max-w-lg text-center mb-8 leading-relaxed">
          Analiza la demanda, la rotación y la caducidad de cada producto de la sucursal, sugiere qué precios
          bajar para vender más y ganar más, y cuándo reponer.
        </p>
        <div className="mb-8">{controls}</div>
        <button
          onClick={() => { setStarted(true); if (started) analysisQuery.refetch(); }}
          disabled={!selectedBranch}
          className="group relative flex items-center gap-3 bg-gray-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-black transition-all hover:scale-105 active:scale-95 shadow-xl shadow-gray-200 cursor-pointer disabled:opacity-50"
        >
          <Play className="h-5 w-5 fill-current" />
          Comenzar Análisis
        </button>
        {analysisQuery.isError && (
          <div className="mt-6 flex items-center gap-2 text-rose-600 bg-rose-50 px-4 py-2 rounded-xl border border-rose-100 italic text-sm">
            <AlertTriangle className="h-4 w-4" />
            No se pudo generar el análisis. Intenta de nuevo.
          </div>
        )}
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[3rem] shadow-sm">
        <Loader2 className="h-16 w-16 text-blue-500 animate-spin mb-6" />
        <h3 className="text-xl font-bold text-gray-900">Calculando modelos...</h3>
        <p className="text-gray-500 mt-2 animate-pulse">Demanda, lotes por caducidad, elasticidad y precios óptimos</p>
      </div>
    );
  }

  const { summary, products } = analysis;
  const restock = products
    .filter((p) => p.daily_demand > 0)
    .sort((a, b) => (a.restock.days_until_reorder ?? Infinity) - (b.restock.days_until_reorder ?? Infinity));
  const critical = restock.filter((p) => p.stock <= p.restock.reorder_point).length;

  return (
    <div className="space-y-12">
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            {analysis.branch.name} · {analysis.generated_on}
          </p>
          <h2 className="text-2xl font-black text-gray-900">{summary.products} productos analizados</h2>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {controls}
          <button
            onClick={() => analysisQuery.refetch()}
            disabled={analysisQuery.isFetching}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-900 px-5 py-2.5 rounded-xl font-bold hover:bg-gray-50 cursor-pointer disabled:opacity-50"
          >
            {analysisQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
            Actualizar
          </button>
          <button
            onClick={() => exportInventoryAnalysis(analysis)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-emerald-700 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard title="Capital en Mercancía" value={money(summary.stock_value_cost)} subtitle="Valor total a costo" icon={Anchor} color="slate" />
        <SummaryCard title="Valor de Venta" value={money(summary.stock_value_price)} subtitle="Stock a precio actual (sin IVA)" icon={DollarSign} color="emerald" />
        <SummaryCard
          title="En Riesgo de Vencer"
          value={money(summary.value_at_risk)}
          subtitle={`${summary.units_at_risk.toFixed(0)} unidades a costo`}
          icon={Hourglass}
          color={summary.value_at_risk > 0 ? 'rose' : 'emerald'}
        />
        <SummaryCard
          title="Ganancia por Ajustes"
          value={money(summary.expected_profit_gain)}
          subtitle={`${summary.suggestions_count} cambios en ${analysis.params.horizon_days} días`}
          icon={TrendingUp}
          color="blue"
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <InsightCard icon={Target} tone="purple" label="Stock Muerto" value={String(summary.dead_stock_count)}
          hint={`${money(summary.dead_stock_value)} inmovilizados sin ventas`} />
        <InsightCard icon={BarChart2} tone="blue" label="Concentración (Pareto)"
          value={summary.top20_revenue_share === null ? '—' : `${(summary.top20_revenue_share * 100).toFixed(0)}%`}
          hint="Ingresos del 20 % de productos más vendidos" />
        <InsightCard icon={Tags} tone="orange" label="Sin Categoría de Caducidad" value={String(summary.unclassified_count)}
          hint="Clasifícalos en la ficha del producto para evaluar su vencimiento" />
      </section>

      <PriceSuggestions products={products} horizonDays={analysis.params.horizon_days} />

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Reposición</h2>
            <p className="text-gray-500 font-medium">Lote económico (EOQ) con stock de seguridad estadístico</p>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border ${critical > 0 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-bold uppercase tracking-wider">{critical} bajo el punto de pedido</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {restock.slice(0, 6).map((p) => <RestockCard key={p.product_id} product={p} />)}
          {restock.length === 0 && (
            <div className="col-span-full py-10 text-center text-gray-400 italic">No hay productos con ventas en el periodo.</div>
          )}
        </div>

        {restock.length > 0 && (
          <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Días hasta agotarse y hasta pedir</h3>
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={restock.slice(0, 8).map((p) => ({
                    name: p.name,
                    empty: p.restock.days_until_empty ?? 0,
                    reorder: p.restock.days_until_reorder ?? 0,
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" angle={-15} textAnchor="end" interval={0} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} dy={20} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    formatter={(value, name) => [`${Math.floor(Number(value))} días`, name]}
                  />
                  <Bar dataKey="empty" name="Hasta agotarse" fill="#3b82f6" fillOpacity={0.25} radius={[8, 8, 0, 0]} />
                  <Bar dataKey="reorder" name="Hasta pedir" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      <section className="bg-slate-900 p-10 rounded-[3rem] text-white">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-blue-500/20 p-3 rounded-2xl border border-blue-500/30">
            <Info className="h-6 w-6 text-blue-400" />
          </div>
          <h3 className="text-2xl font-black tracking-tight">Fundamentos del Análisis</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {analysis.methodology.map((m) => (
            <div key={m.topic} className="p-6 bg-white/5 rounded-3xl border border-white/10">
              <h4 className="text-blue-300 font-bold uppercase tracking-widest text-xs mb-2">{m.topic}</h4>
              <p className="text-sm text-gray-300 leading-relaxed">{m.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function RestockCard({ product: p }: { product: ProductAnalysisOut }) {
  const reorderIn = p.restock.days_until_reorder ?? 0;
  const urgent = reorderIn < 3;
  const fill = Math.min(100, (p.stock / Math.max(1, p.restock.eoq + p.restock.safety_stock)) * 100);
  return (
    <div className="bg-white p-6 rounded-4xl border border-gray-100 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-500 bg-blue-50 px-3 py-1 rounded-full">
          {p.abc}{p.xyz} · {p.daily_demand.toFixed(1)} uds/día
        </span>
        <Package className="h-5 w-5 text-gray-300" />
      </div>
      <h4 className="font-bold text-gray-900 text-lg mb-1 truncate" title={p.name}>{p.name}</h4>
      <div className="mt-5 flex justify-between items-end">
        <div>
          <p className="text-[10px] text-gray-400 font-bold uppercase">Pedir en</p>
          <p className={`text-2xl font-black ${urgent ? 'text-rose-500' : 'text-emerald-500'}`}>{Math.floor(reorderIn)} días</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-400 font-bold uppercase">Pedido sugerido</p>
          <p className="text-lg font-extrabold text-blue-600">{Math.ceil(p.restock.eoq)} uds.</p>
          {p.restock.capped_by_shelf_life && <p className="text-[10px] text-amber-600 font-bold">limitado por vida útil</p>}
        </div>
      </div>
      <div className="mt-4 space-y-1">
        <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase">
          <span>Stock: {p.stock.toFixed(0)}</span>
          <span>Seguridad: {Math.ceil(p.restock.safety_stock)}</span>
        </div>
        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
          <div className={`h-full ${urgent ? 'bg-rose-500' : 'bg-blue-500'}`} style={{ width: `${fill}%` }} />
        </div>
      </div>
    </div>
  );
}

const INSIGHT_TONES = {
  purple: 'bg-purple-50 text-purple-500',
  blue: 'bg-blue-50 text-blue-500',
  orange: 'bg-orange-50 text-orange-500',
};

function InsightCard({ icon: Icon, tone, label, value, hint }: {
  icon: React.ElementType; tone: keyof typeof INSIGHT_TONES; label: string; value: string; hint: string;
}) {
  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center gap-5">
      <div className={`p-4 rounded-2xl ${INSIGHT_TONES[tone]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        <h4 className="text-xl font-black text-gray-900">{value}</h4>
        <p className="text-[10px] text-gray-500">{hint}</p>
      </div>
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  color: 'blue' | 'emerald' | 'rose' | 'slate' | 'orange';
}

function SummaryCard({ title, value, subtitle, icon: Icon, color }: SummaryCardProps) {
  const themes = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
    slate: 'bg-slate-50 text-slate-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="p-6 rounded-[2.5rem] border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${themes[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{title}</p>
      <h3 className="text-2xl font-black text-gray-900 mt-1">{value}</h3>
      <p className="text-xs font-bold text-gray-500 mt-1">{subtitle}</p>
    </div>
  );
}
