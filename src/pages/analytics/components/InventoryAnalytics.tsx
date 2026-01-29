import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  v1SalesListOptions, 
  v1SalesRetrieveOptions, 
  v1ProductBranchStockListOptions, 
  v1ProductListOptions 
} from '../../../client/@tanstack/react-query.gen';
import type { ProductMaster } from '../../../client/types.gen';
import { useBranch } from '../../../context/BranchContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { 
  Package, Info, AlertTriangle, Play, Loader2, TrendingUp, History,
  DollarSign, BarChart2, Target, Zap, Anchor
} from 'lucide-react';
import { differenceInDays } from 'date-fns';

interface InventoryAnalysisResult {
    productId: string;
    productName: string;
    currentStock: number;
    dailyDemand: number;
    qAsterisk: number;
    sAsterisk: number; // Max shortage for low rotation
    safetyStock: number; // Safety stock for high rotation
    daysUntilEmpty: number;
    restockInDays: number;
    rotationType: 'high' | 'low';
    costPrice: number;
    profitMargin: number;
    totalCostValue: number;
    totalSaleValue: number;
}

export default function InventoryAnalytics() {
  const { selectedBranch } = useBranch();
  const queryClient = useQueryClient();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<InventoryAnalysisResult[] | null>(null);
  const [summaryStats, setSummaryStats] = useState<{
    totalCostValue: number;
    totalSaleValue: number;
    potentialProfit: number;
    criticalCount: number;
    deadStockCount: number;
    avgTurnover: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStartAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      // 1. Fetch last 100 sales summaries
      const salesList = await queryClient.fetchQuery(
        v1SalesListOptions({
          // @ts-expect-error - Query params
          query: { branch: selectedBranch?.id, page_size: 100 }
        })
      );

      if (!salesList.results || salesList.results.length < 2) {
        throw new Error("No hay suficientes ventas para realizar un análisis estadístico.");
      }

      const detailsPromises = salesList.results.map(sale => 
        queryClient.fetchQuery(v1SalesRetrieveOptions({ path: { id: sale.id } }))
      );
      const salesWithDetails = await Promise.all(detailsPromises);

      // 3. Fetch all products (for valuation and dead stock)
      const productsData = await queryClient.fetchQuery(
        v1ProductListOptions({
          // @ts-expect-error - pagination might be needed but current type is Array
          query: { page_size: 1000 }
        })
      );

      // 4. Fetch current stock
      const stockData = await queryClient.fetchQuery(
        v1ProductBranchStockListOptions({
           // @ts-expect-error - Branch query
           query: { branch: selectedBranch?.id }
        })
      );

      // 5. Aggregate Demand
      const productSummary: Record<string, { name: string, qty: number }> = {};
      salesWithDetails.forEach(sale => {
        sale.sale_details.forEach(detail => {
          if (!productSummary[detail.product]) {
            productSummary[detail.product] = { name: detail.product_name, qty: 0 };
          }
          productSummary[detail.product].qty += parseFloat(detail.quantity);
        });
      });

      // Calculate sample period
      const dates = salesList.results.map(s => new Date(s.created_at).getTime());
      const minDate = Math.min(...dates);
      const maxDate = Math.max(...dates);
      const daysDiff = Math.max(1, differenceInDays(maxDate, minDate));

      // 6. Calculate Model for All Products and Categorize
      let totalCostValue = 0;
      let totalSaleValue = 0;
      let criticalCount = 0;
      let deadStockCount = 0;

      const allResults: InventoryAnalysisResult[] = (productsData as ProductMaster[])
        .map((product: ProductMaster) => {
          const id = product.id;
          const info = productSummary[id] || { name: product.name, qty: 0 };
          const costPrice = parseFloat(product.cost_price_usd);
          const profitMargin = parseFloat(product.profit_margin);
          const salePrice = costPrice * (1 + profitMargin / 100);

          const d = info.qty / daysDiff; // daily demand
          const D = d * 365; // annual demand
          
          if (info.qty === 0) deadStockCount++;

          // Constants for model
          const S = 10; // Setup cost
          const H = Math.max(0.5, costPrice * 0.2);  // Holding cost approx 20% of value
          const B = costPrice * 2; // Shortage cost

          const isHighRotation = d > 0.1; // Lowered threshold to catch more products
          
          let qAsterisk = 0;
          let sAsterisk = 0;
          let safetyStock = 0;
          let restockInDays = 0;

          const currentStockObj = stockData.find(s => s.product_id === id);
          const currentStock = currentStockObj ? parseFloat(currentStockObj.stock) : 0;
          const daysUntilEmpty = d > 0 ? currentStock / d : 999;

          totalCostValue += currentStock * costPrice;
          totalSaleValue += currentStock * salePrice;

          if (isHighRotation) {
            // EOQ Standard
            qAsterisk = Math.sqrt((2 * D * S) / H);
            // Safety Stock: 3 days of demand
            safetyStock = (d * 3);
            
            const stockAboveSafety = Math.max(0, currentStock - safetyStock);
            restockInDays = d > 0 ? stockAboveSafety / d : 999;
          } else {
            // EOQ with Shortages (Backorders)
            qAsterisk = Math.sqrt(((2 * D * S) / H) * ((H + B) / B));
            sAsterisk = qAsterisk * (H / (H + B));
            restockInDays = daysUntilEmpty + (d > 0 ? sAsterisk / d : 0);
          }

          if (currentStock <= safetyStock && d > 0) criticalCount++;

          return {
            productId: id,
            productName: product.name,
            currentStock,
            dailyDemand: d,
            qAsterisk,
            sAsterisk,
            safetyStock,
            daysUntilEmpty,
            restockInDays,
            rotationType: (isHighRotation ? 'high' : 'low') as 'high' | 'low',
            costPrice,
            profitMargin,
            totalCostValue: currentStock * costPrice,
            totalSaleValue: currentStock * salePrice
          };
        })
        .filter((r: InventoryAnalysisResult) => r.totalCostValue > 0 || r.dailyDemand > 0) // Filter out irrelevant items
        .sort((a: InventoryAnalysisResult, b: InventoryAnalysisResult) => b.dailyDemand - a.dailyDemand);

      setSummaryStats({
        totalCostValue,
        totalSaleValue,
        potentialProfit: totalSaleValue - totalCostValue,
        criticalCount,
        deadStockCount,
        avgTurnover: totalCostValue > 0 ? (allResults.reduce((acc: number, r: InventoryAnalysisResult) => acc + (r.dailyDemand * 30 * r.costPrice), 0) / totalCostValue) : 0
      });
      setAnalysisResults(allResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error al procesar el análisis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!analysisResults && !isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[3rem] border border-dashed border-gray-200 shadow-sm">
        <div className="bg-orange-50 p-6 rounded-full mb-6">
          <History className="h-12 w-12 text-orange-500" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Análisis Inteligente de Inventario</h3>
        <p className="text-gray-500 max-w-md text-center mb-10 leading-relaxed">
          Para generar proyecciones precisas, necesitamos analizar tu historial de ventas recientes y cruzarlo con el stock actual de tus sucursales.
        </p>
        
        <button
          onClick={handleStartAnalysis}
          className="group relative flex items-center gap-3 bg-gray-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-black transition-all hover:scale-105 active:scale-95 shadow-xl shadow-gray-200 cursor-pointer"
        >
          <Play className="h-5 w-5 fill-current" />
          Comenzar Análisis
          <div className="absolute -inset-1 bg-linear-to-r from-orange-400 to-rose-400 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity"></div>
        </button>
        
        {error && (
          <div className="mt-6 flex items-center gap-2 text-rose-600 bg-rose-50 px-4 py-2 rounded-xl border border-rose-100 italic text-sm">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[3rem] shadow-sm">
        <Loader2 className="h-16 w-16 text-blue-500 animate-spin mb-6" />
        <h3 className="text-xl font-bold text-gray-900">Calculando Modelos...</h3>
        <p className="text-gray-500 mt-2 animate-pulse">Agregando detalles de ventas y proyectando demanda</p>
      </div>
    );
  }

  const highRotation = analysisResults?.filter(r => r.rotationType === 'high') || [];
  const lowRotation = analysisResults?.filter(r => r.rotationType === 'low') || [];

  return (
    <div className="space-y-12">
      {/* KPI Overlays */}
      {summaryStats && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <SummaryCard 
            title="Capital en Mercancía" 
            value={`$${summaryStats.totalCostValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtitle="Valor Total a Costo"
            icon={Anchor}
            color="slate"
          />
          <SummaryCard 
            title="Valor de Venta" 
            value={`$${summaryStats.totalSaleValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtitle="Estimado de Ingreso"
            icon={DollarSign}
            color="emerald"
          />
          <SummaryCard 
            title="Utilidad Potencial" 
            value={`$${summaryStats.potentialProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtitle={`Margen: ${((summaryStats.potentialProfit / summaryStats.totalSaleValue) * 100).toFixed(1)}%`}
            icon={TrendingUp}
            color="blue"
          />
          <SummaryCard 
            title="Salud de Stock" 
            value={summaryStats.criticalCount.toString()}
            subtitle="Productos Críticos"
            icon={AlertTriangle}
            color={summaryStats.criticalCount > 0 ? 'rose' : 'emerald'}
          />
        </section>
      )}

      {/* Advanced Insights Row */}
      {summaryStats && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center gap-5">
            <div className="bg-orange-50 p-4 rounded-2xl">
              <Zap className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rotación Mensual</p>
              <h4 className="text-xl font-black text-gray-900">{summaryStats.avgTurnover.toFixed(1)}x</h4>
              <p className="text-[10px] text-gray-500">Ciclos de stock por mes</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center gap-5">
            <div className="bg-purple-50 p-4 rounded-2xl">
              <Target className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Stock Muerto</p>
              <h4 className="text-xl font-black text-gray-900">{summaryStats.deadStockCount}</h4>
              <p className="text-[10px] text-gray-500">Sin ventas en la muestra</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center gap-5">
            <div className="bg-blue-50 p-4 rounded-2xl">
              <BarChart2 className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Efectividad Pareto</p>
              <h4 className="text-xl font-black text-gray-900">
                {analysisResults && analysisResults.length > 0 ? (
                  (analysisResults.slice(0, Math.ceil(analysisResults.length * 0.2)).reduce((acc, r) => acc + r.dailyDemand, 0) / 
                   analysisResults.reduce((acc, r) => acc + r.dailyDemand, 0) * 100 || 0).toFixed(0)
                ) : '0'}%
              </h4>
              <p className="text-[10px] text-gray-500">Ventas en el top 20% productos</p>
            </div>
          </div>
        </section>
      )}

      {/* High Rotation Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Alta Rotación</h2>
            <p className="text-gray-500 font-medium">Modelado con EOQ Estándar + Stock de Seguridad Robusto</p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl border border-emerald-100">
            <TrendingUp className="h-5 w-5" />
            <span className="text-sm font-bold uppercase tracking-wider">Alta Disponibilidad</span>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm">
          <div className="flex items-start gap-6 mb-8">
            <div className="bg-blue-50 p-4 rounded-3xl">
              <Info className="h-8 w-8 text-blue-500" />
            </div>
            <div className="max-w-3xl">
              <h4 className="text-xl font-bold text-gray-900 mb-2">Estrategia de Alta Disponibilidad</h4>
              <p className="text-gray-600 leading-relaxed">
                Para estos productos, el objetivo primordial es <strong>evitar el quiebre de stock</strong>. 
                Utilizamos el modelo de <span className="font-bold text-blue-600">Lote Económico Estándar (EOQ)</span> sumado a un 
                <span className="font-bold text-orange-600"> Stock de Seguridad Robusto</span>. Esto garantiza que siempre 
                tengas unidades suficientes para cubrir la demanda variable y las demoras de proveedores.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {highRotation.slice(0, 6).map((res) => (
              <div key={res.productId} className="bg-gray-50/50 p-6 rounded-4xl border border-gray-100 transition-all hover:scale-[1.02] hover:bg-white hover:shadow-xl group">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-500 bg-blue-50 px-3 py-1 rounded-full">ESTRATEGIA A</span>
                  <Package className="h-5 w-5 text-gray-300 group-hover:text-blue-400 transition-colors" />
                </div>
                <h4 className="font-bold text-gray-900 text-lg mb-1 truncate" title={res.productName}>{res.productName}</h4>
                
                <div className="mt-6 space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Reponer en</p>
                      <p className={`text-2xl font-black ${res.restockInDays < 3 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {Math.max(0, Math.floor(res.restockInDays))} días
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Pedido Sugerido</p>
                      <p className="text-lg font-extrabold text-blue-600">{Math.ceil(res.qAsterisk)} uds.</p>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase">
                      <span>Stock Actual: {res.currentStock}</span>
                      <div className="flex items-center gap-1 group/info relative">
                        <span>Seguridad: {Math.ceil(res.safetyStock)}</span>
                        <Info className="h-3 w-3 text-blue-400 cursor-help" />
                        <div className="absolute bottom-full mb-2 right-0 w-48 p-3 bg-gray-900 text-[9px] text-gray-200 rounded-xl opacity-0 group-hover/info:opacity-100 transition-opacity pointer-events-none z-50 normal-case shadow-2xl">
                          <p className="font-bold text-white mb-1">Stock de Seguridad:</p>
                          Es el colchón de inventario para cubrir variaciones en la demanda o retrasos del proveedor. <span className="text-blue-400 font-bold">El sistema sugiere reponer ANTES de tocar este nivel.</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${res.restockInDays < 3 ? 'bg-rose-500' : 'bg-blue-500'}`} 
                        style={{ width: `${Math.min(100, (res.currentStock / (res.qAsterisk + res.safetyStock)) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {highRotation.length === 0 && (
              <div className="col-span-full py-10 text-center text-gray-400 italic">No se detectaron productos de alta rotación significativos en el periodo.</div>
            )}
          </div>
        </div>
      </section>

      {/* Low Rotation Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Baja Rotación</h2>
            <p className="text-gray-500 font-medium">Modelado con EOQ con Déficit Planificado</p>
          </div>
          <div className="flex items-center gap-2 bg-amber-50 text-amber-600 px-4 py-2 rounded-2xl border border-amber-100">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-bold uppercase tracking-wider">Optimización de Costos</span>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm">
          <div className="flex items-start gap-6 mb-8">
            <div className="bg-amber-50 p-4 rounded-3xl">
              <TrendingUp className="h-8 w-8 text-amber-500" />
            </div>
            <div className="max-w-3xl">
              <h4 className="text-xl font-bold text-gray-900 mb-2">Estrategia de Optimización por Déficit</h4>
              <p className="text-gray-600 leading-relaxed">
                Para productos que se venden poco, mantener stock físico es costoso. Aplicamos un modelo de 
                <span className="font-bold text-amber-600"> Lote Económico con Déficit</span> donde permitimos que el stock llegue a cero 
                y se acumule una pequeña deuda de tiempo antes de pedir. Esto minimiza el costo total de almacenamiento.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lowRotation.slice(0, 6).map((res) => (
              <div key={res.productId} className="bg-gray-50/50 p-6 rounded-4xl border border-gray-100 transition-all hover:scale-[1.02] hover:bg-white hover:shadow-xl">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500 bg-amber-50 px-3 py-1 rounded-full">ESTRATEGIA B</span>
                  <History className="h-5 w-5 text-gray-300" />
                </div>
                <h4 className="font-bold text-gray-900 text-lg mb-1 truncate" title={res.productName}>{res.productName}</h4>
                
                <div className="mt-6 space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Pedido Óptimo en</p>
                      <p className="text-2xl font-black text-amber-600">
                        {Math.max(0, Math.floor(res.restockInDays))} días
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Lote (Q*)</p>
                      <p className="text-lg font-extrabold text-gray-700">{Math.ceil(res.qAsterisk)} uds.</p>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Déficit Máximo Permitido</p>
                    <p className="font-bold text-rose-500">{Math.ceil(res.sAsterisk)} unidades</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Visual Analytics Summary */}
      <section className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm">
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Reporte Gráfico de Reposición</h3>
          <p className="text-gray-500 text-sm italic">Vista comparativa de días restantes para los top productos de ambas categorías</p>
        </div>

        <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analysisResults?.slice(0, 8) || []} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                        dataKey="productName" 
                        angle={-15} 
                        textAnchor="end" 
                        interval={0}
                        tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}}
                        dy={20}
                    />
                    <YAxis label={{ value: 'Días para pedir', angle: -90, position: 'insideLeft', style: {fontWeight: 700, fill: '#94a3b8', fontSize: 12} }} />
                    <Tooltip 
                        contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number | undefined, name: string | undefined) => [
                          value !== undefined ? `${Math.floor(value)} días` : 'N/A', 
                          name || ''
                        ]}
                    />
                    <Bar dataKey="daysUntilEmpty" name="Stock Agotado (Días)" radius={[8, 8, 0, 0]}>
                        {analysisResults?.slice(0, 8).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.rotationType === 'high' ? '#3b82f6' : '#f59e0b'} opacity={0.2} />
                        ))}
                    </Bar>
                    <Bar dataKey="restockInDays" name="Momento de Pedido (Días)" radius={[8, 8, 0, 0]}>
                        {analysisResults?.slice(0, 8).map((entry, index) => (
                            <Cell key={`cell2-${index}`} fill={entry.rotationType === 'high' ? '#3b82f6' : '#f59e0b'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-[10px] font-bold text-gray-500 uppercase">Alta Rotación (Foco Disponibilidad)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
            <span className="text-[10px] font-bold text-gray-500 uppercase">Baja Rotación (Foco Costo/Déficit)</span>
          </div>
        </div>
      </section>

      {/* Technical Methodology Section */}
      <section className="bg-slate-900 p-10 rounded-[3rem] text-white overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
          <TrendingUp className="h-40 w-40 text-blue-400 rotate-12" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-blue-500/20 p-3 rounded-2xl border border-blue-500/30">
              <Info className="h-6 w-6 text-blue-400" />
            </div>
            <h3 className="text-2xl font-black tracking-tight">Fundamentos Matemáticos del Análisis</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-4">
              <h4 className="text-blue-400 font-bold uppercase tracking-widest text-xs">Modelo para Alta Rotación (EOQ Estándar)</h4>
              <div className="p-6 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-sm">
                <code className="text-sm font-mono text-blue-300">Q* = √[2DS/H]</code>
                <p className="mt-4 text-sm text-gray-400 leading-relaxed">
                   Este modelo calcula el <span className="text-white font-bold">Lote Económico de Pedido</span> ideal para minimizar los costos totales sin admitir faltantes. 
                   Se aplica a productos de alta venta para garantizar que el stock nunca se agote, manteniendo un flujo constante y niveles de servicio máximos.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-amber-400 font-bold uppercase tracking-widest text-xs">Modelo para Baja Rotación (EOQ con Déficit)</h4>
              <div className="p-6 bg-amber-500/10 rounded-3xl border border-amber-500/20 backdrop-blur-sm relative overflow-hidden">
                <code className="text-sm font-mono text-amber-300">Q* = √[(2DS/H) * ((H+B)/B)]</code>
                <p className="mt-4 text-sm text-gray-300 leading-relaxed">
                  Para productos con menos movimiento, el costo de mantener inventario es superior al "costo de oportunidad" de no tenerlo inmediatamente. 
                  Esta fórmula permite <span className="text-amber-400 font-bold">faltantes planificados</span>, permitiendo que el sistema ahorre dinero al no almacenar productos que rotan lentamente.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-white/5 flex flex-wrap gap-x-8 gap-y-2 justify-center">
            <div className="flex gap-2 text-[10px] font-bold text-gray-500"><span className="text-gray-400">D:</span> Demanda Anual</div>
            <div className="flex gap-2 text-[10px] font-bold text-gray-500"><span className="text-gray-400">S:</span> Costo de Preparación</div>
            <div className="flex gap-2 text-[10px] font-bold text-gray-500"><span className="text-gray-400">H:</span> Costo de Almacenamiento</div>
            <div className="flex gap-2 text-[10px] font-bold text-gray-500"><span className="text-gray-400">B:</span> Costo de Faltante</div>
          </div>
        </div>
      </section>

      {/* Recalculate Button */}
      <div className="flex justify-center py-8">
        <button 
          onClick={handleStartAnalysis}
          className="group flex items-center gap-3 bg-gray-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-black transition-all hover:scale-105 active:scale-95 shadow-xl shadow-gray-200 cursor-pointer"
        >
          <History className="h-5 w-5" />
          Actualizar Análisis Completo
        </button>
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
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
  };

  return (
    <div className={`p-6 rounded-[2.5rem] border bg-white shadow-sm transition-all hover:shadow-md`}>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${themes[color].split(' ')[0]} ${themes[color].split(' ')[1]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{title}</p>
      <h3 className="text-2xl font-black text-gray-900 mt-1">{value}</h3>
      <p className="text-xs font-bold text-gray-500 mt-1">{subtitle}</p>
    </div>
  );
}
