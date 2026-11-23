import * as XLSX from 'xlsx';
import type { InventoryAnalysisOut, ProductAnalysisOut } from '../client/types.gen';
import { perishabilityFormValue, perishabilityLabel } from '../lib/perishability';

export const ACTION_LABELS: Record<string, string> = {
  keep: 'Mantener',
  markdown: 'Rebajar',
  no_data: 'Sin datos',
};

type Row = Record<string, string | number | null>;

// Rounded numbers, not formatted strings: the sheet stays sortable and
// summable in Excel.
const n = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined ? null : Number(value.toFixed(digits));

export function isPriceChange(product: ProductAnalysisOut) {
  return product.pricing.action === 'markdown';
}

export function profitGain(product: ProductAnalysisOut) {
  return product.pricing.expected_horizon_profit - product.pricing.current_horizon_profit;
}

export function buildSummaryRows(analysis: InventoryAnalysisOut): Row[] {
  const s = analysis.summary;
  const horizon = analysis.params.horizon_days;
  return [
    { Indicador: 'Sucursal', Valor: analysis.branch.name },
    { Indicador: 'Fecha del análisis', Valor: analysis.generated_on },
    { Indicador: 'Historial analizado (días)', Valor: analysis.params.window_days },
    { Indicador: 'Horizonte de evaluación (días)', Valor: horizon },
    { Indicador: 'Productos analizados', Valor: s.products },
    { Indicador: 'Capital en mercancía (USD, a costo)', Valor: n(s.stock_value_cost) },
    { Indicador: 'Valor de la mercancía (USD, a precio)', Valor: n(s.stock_value_price) },
    { Indicador: 'Ingresos del periodo (USD)', Valor: n(s.revenue) },
    { Indicador: 'Productos sin ventas (stock muerto)', Valor: s.dead_stock_count },
    { Indicador: 'Capital en stock muerto (USD)', Valor: n(s.dead_stock_value) },
    { Indicador: 'Unidades en riesgo de vencer', Valor: n(s.units_at_risk) },
    { Indicador: 'Valor en riesgo de vencer (USD, a costo)', Valor: n(s.value_at_risk) },
    { Indicador: 'Cambios de precio sugeridos', Valor: s.suggestions_count },
    { Indicador: `Ganancia adicional esperada en ${horizon} días (USD)`, Valor: n(s.expected_profit_gain) },
    { Indicador: 'Ingresos concentrados en el 20 % de productos', Valor: s.top20_revenue_share === null ? null : n(s.top20_revenue_share * 100, 1) },
    { Indicador: 'Productos sin categoría de caducidad', Valor: s.unclassified_count },
  ];
}

export function buildSuggestionRows(analysis: InventoryAnalysisOut): Row[] {
  return analysis.products
    .filter(isPriceChange)
    .sort((a, b) => profitGain(b) - profitGain(a))
    .map((p) => ({
      'Producto': p.name,
      'SKU': p.sku ?? '',
      'Categoría': p.category ?? '',
      'Acción': ACTION_LABELS[p.pricing.action],
      'Motivo': p.pricing.reason,
      'Precio actual (USD)': n(p.pricing.current_price),
      'Precio sugerido (USD)': n(p.pricing.suggested_price),
      'Cambio de precio (%)': n(p.pricing.change_pct, 1),
      'Costo (USD)': n(p.cost),
      'Margen actual (%)': n(p.pricing.current_margin_pct, 1),
      'Margen nuevo (%)': n(p.pricing.new_margin_pct, 1),
      'Demanda actual (uds/día)': n(p.daily_demand, 2),
      'Demanda esperada (uds/día)': n(p.pricing.expected_daily_demand, 2),
      'Variación de volumen esperada (%)': n(p.pricing.expected_volume_change_pct, 1),
      'Volumen necesario para equilibrio (%)': n(p.pricing.breakeven_volume_change_pct, 1),
      'Elasticidad': n(p.elasticity.value, 2),
      'Origen elasticidad': p.elasticity.source === 'data' ? `Datos (${p.elasticity.weeks_used} sem.)` : 'Valor conservador',
      'Stock': n(p.stock, 2),
      'Caducidad': perishabilityLabel(perishabilityFormValue(p.perishability)),
      'Vence en (días)': p.expiry.days_to_earliest_expiry,
      'Uds. en riesgo antes': n(p.pricing.units_at_risk_current, 2),
      'Uds. en riesgo después': n(p.pricing.units_at_risk_new, 2),
      'Ganancia actual en horizonte (USD)': n(p.pricing.current_horizon_profit),
      'Ganancia esperada en horizonte (USD)': n(p.pricing.expected_horizon_profit),
      'Ganancia adicional (USD)': n(profitGain(p)),
    }));
}

export function buildProductRows(analysis: InventoryAnalysisOut): Row[] {
  return [...analysis.products]
    .sort((a, b) => b.revenue - a.revenue)
    .map((p) => ({
      'Producto': p.name,
      'SKU': p.sku ?? '',
      'Categoría': p.category ?? '',
      'Clase ABC': p.abc,
      'Clase XYZ': p.xyz,
      'Ingresos del periodo (USD)': n(p.revenue),
      'Unidades vendidas': n(p.units_sold, 2),
      'Demanda (uds/día)': n(p.daily_demand, 2),
      'Días observados': p.days_observed,
      'Stock': n(p.stock, 2),
      'Capital a costo (USD)': n(p.stock_value_cost),
      'Cobertura (días)': n(p.coverage_days, 1),
      'Rotación anual (veces)': n(p.turnover_annual, 2),
      'Stock muerto': p.is_dead_stock ? 'Sí' : 'No',
      'Caducidad': perishabilityLabel(perishabilityFormValue(p.perishability)),
      'Vida útil (días)': p.shelf_life_days ?? null,
      'Vence en (días)': p.expiry.days_to_earliest_expiry,
      'Uds. en riesgo de vencer': n(p.expiry.units_at_risk, 2),
      'Uds. de edad desconocida': n(p.expiry.unknown_age_units, 2),
      'Pedido económico EOQ (uds)': n(p.restock.eoq, 1),
      'Stock de seguridad (uds)': n(p.restock.safety_stock, 1),
      'Punto de pedido (uds)': n(p.restock.reorder_point, 1),
      'Pedir en (días)': n(p.restock.days_until_reorder, 1),
      'Acción de precio': ACTION_LABELS[p.pricing.action],
    }));
}

export function buildMethodologyRows(analysis: InventoryAnalysisOut): Row[] {
  return analysis.methodology.map((m) => ({ Tema: m.topic, Detalle: m.detail }));
}

function sheet(rows: Row[], widths: number[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = widths.map((wch) => ({ wch }));
  return ws;
}

export function exportInventoryAnalysis(analysis: InventoryAnalysisOut) {
  const suggestions = buildSuggestionRows(analysis);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(buildSummaryRows(analysis), [48, 24]), 'Resumen');
  XLSX.utils.book_append_sheet(
    wb,
    suggestions.length > 0
      ? sheet(suggestions, [32, 14, 18, 10, 52, ...Array(20).fill(16)])
      : sheet([{ Resultado: 'No hay cambios de precio sugeridos para esta sucursal.' }], [60]),
    'Cambios sugeridos',
  );
  XLSX.utils.book_append_sheet(wb, sheet(buildProductRows(analysis), [32, 14, 18, ...Array(21).fill(14)]), 'Análisis por producto');
  XLSX.utils.book_append_sheet(wb, sheet(buildMethodologyRows(analysis), [30, 140]), 'Metodología');

  const branch = analysis.branch.name.replace(/[^\p{L}\p{N}]+/gu, '_');
  XLSX.writeFile(wb, `Analisis_precios_${branch}_${analysis.generated_on}.xlsx`);
}
