import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { v1SalesListOptions, v1SalesRetrieveOptions, v1ProductBranchStockListOptions } from '../../../client/@tanstack/react-query.gen';
import { useBranch } from '../../../context/BranchContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { 
  Package, Info, AlertTriangle, Play, Loader2, TrendingUp, History
} from 'lucide-react';
import { differenceInDays } from 'date-fns';

interface InventoryAnalysisResult {
    productId: string;
    productName: string;
    currentStock: number;
    dailyDemand: number;
    qAsterisk: number;
    sAsterisk: number;
    daysUntilEmpty: number;
    restockInDays: number;
}

export default function InventoryAnalytics() {
  const { selectedBranch } = useBranch();
  const queryClient = useQueryClient();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<InventoryAnalysisResult[] | null>(null);
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

      // 2. Fetch details for each sale concurrently
      const detailsPromises = salesList.results.map(sale => 
        queryClient.fetchQuery(v1SalesRetrieveOptions({ path: { id: sale.id } }))
      );
      const salesWithDetails = await Promise.all(detailsPromises);

      // 3. Fetch current stock
      const stockData = await queryClient.fetchQuery(
        v1ProductBranchStockListOptions({
           // @ts-expect-error - Branch query
           query: { branch: selectedBranch?.id }
        })
      );

      // 4. Aggregate Demand
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

      // 5. Calculate Model for Top Products
      const results: InventoryAnalysisResult[] = Object.entries(productSummary)
        .map(([id, info]) => {
          const d = info.qty / daysDiff; // daily demand
          const D = d * 365; // annual demand
          
          // Constants for model
          const S = 10; // Setup cost
          const H = 2;  // Holding cost annual
          const B = 20; // Shortage cost annual (very high to prevent too much deficit)

          // EOQ with Shortages
          const qAsterisk = Math.sqrt(((2 * D * S) / H) * ((H + B) / B));
          const sAsterisk = qAsterisk * (H / (H + B));
          
          const currentStockObj = stockData.find(s => s.product_id === id);
          const currentStock = currentStockObj ? parseFloat(currentStockObj.stock) : 0;
          
          const daysUntilEmpty = d > 0 ? currentStock / d : 999;
          
          // Simplified restock time: When stock hits Reorder Point
          // In EOQ with shortages, we ideally allow it to hit 0, then go into shortage up to S*, then restock.
          // Restock point is technically "Time until 0 + Time of Shortage".
          const restockInDays = daysUntilEmpty + (d > 0 ? sAsterisk / d : 0);

          return {
            productId: id,
            productName: info.name,
            currentStock,
            dailyDemand: d,
            qAsterisk,
            sAsterisk,
            daysUntilEmpty,
            restockInDays
          };
        })
        .sort((a, b) => b.dailyDemand - a.dailyDemand)
        .slice(0, 5); // Top 5

      setAnalysisResults(results);
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
          className="group relative flex items-center gap-3 bg-gray-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-black transition-all hover:scale-105 active:scale-95 shadow-xl shadow-gray-200"
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

  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {analysisResults?.map((res, idx) => (
          <div key={res.productId} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-extrabold uppercase tracking-tighter text-blue-500 bg-blue-50 px-2 py-0.5 rounded-lg">TOP {idx + 1}</span>
              <Package className="h-4 w-4 text-gray-300" />
            </div>
            <h4 className="font-bold text-gray-900 truncate mb-1" title={res.productName}>{res.productName}</h4>
            <div className="space-y-2 mt-4">
               <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Reponer en</p>
                <p className={`text-xl font-extrabold ${res.restockInDays < 7 ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {Math.max(0, Math.floor(res.restockInDays))} días
                </p>
               </div>
               <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${res.restockInDays < 7 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                    style={{ width: `${Math.min(100, (res.currentStock / (res.qAsterisk || 1)) * 100)}%` }}
                  ></div>
               </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Chart */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Proyección de Agotamiento de Stock</h3>
            <p className="text-gray-500 text-sm">Día estimado de reposición óptima (incluyendo déficit planificado)</p>
          </div>
          <button 
            onClick={handleStartAnalysis}
            className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors"
          >
            <History className="h-3 w-3" />
            Recalcular con datos frescos
          </button>
        </div>

        <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analysisResults || []} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                        dataKey="productName" 
                        angle={-15} 
                        textAnchor="end" 
                        interval={0}
                        tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}}
                        dy={20}
                    />
                    <YAxis label={{ value: 'Días restantes', angle: -90, position: 'insideLeft', style: {fontWeight: 700, fill: '#94a3b8', fontSize: 12} }} />
                    <Tooltip 
                        contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number | undefined, name: string | undefined) => [
                          value !== undefined ? `${Math.floor(value)} días` : 'N/A', 
                          name || 'N/A'
                        ]}
                    />
                    <Bar dataKey="daysUntilEmpty" name="Stock Agotado" radius={[8, 8, 0, 0]}>
                        {analysisResults?.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.daysUntilEmpty < 5 ? '#f43f5e' : '#94a3b8'} opacity={0.3} />
                        ))}
                    </Bar>
                    <Bar dataKey="restockInDays" name="Fecha de Reposición" radius={[8, 8, 0, 0]}>
                        {analysisResults?.map((entry, index) => (
                            <Cell key={`cell2-${index}`} fill={entry.restockInDays < 7 ? '#f43f5e' : '#3b82f6'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* Info Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-linear-to-br from-gray-900 to-gray-800 p-8 rounded-[2.5rem] text-white shadow-xl shadow-gray-200">
           <div className="flex items-center gap-3 mb-6">
             <Info className="h-6 w-6 text-blue-400" />
             <h4 className="text-lg font-bold">¿Cómo leer este análisis?</h4>
           </div>
           <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
              <p>
                El modelo de <span className="text-white font-bold">Lote Económico con Déficit</span> asume que es más rentable permitir faltantes temporales que mantener stock excesivo para productos de alta rotación.
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li><span className="text-white font-bold">Barra Gris Clara:</span> Indica cuándo tu stock físico llegará a cero.</li>
                <li><span className="text-white font-bold">Barra Azul/Roja:</span> Indica el día óptimo para reponer, considerando el déficit máximo permitido por el modelo estadístico.</li>
                <li><span className="text-white font-bold">Q* Sugerido:</span> Es la cantidad que deberías pedir para minimizar tus costos de mantenimiento y pedido simultáneamente.</li>
              </ul>
           </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
            <h4 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                Cantidades de Pedido Sugeridas (Q*)
            </h4>
            <div className="space-y-4">
                {analysisResults?.map(res => (
                    <div key={res.productId} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <span className="font-bold text-gray-700 truncate mr-4">{res.productName}</span>
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-xs">
                             <span className="text-xs font-bold text-gray-400">PEDIR:</span>
                             <span className="font-extrabold text-blue-600">{Math.ceil(res.qAsterisk)} uds.</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
}
