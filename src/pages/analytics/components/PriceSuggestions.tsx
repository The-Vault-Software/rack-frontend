import { useMemo } from 'react';
import { ArrowDownRight, CheckCircle2, Clock, TrendingUp, XCircle } from 'lucide-react';
import type { ProductAnalysisOut } from '../../../client/types.gen';
import { ACTION_LABELS, isPriceChange, profitGain } from '../../../utils/inventoryAnalysisExport';

const money = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`;

interface Props {
  products: ProductAnalysisOut[];
  horizonDays: number;
}

export default function PriceSuggestions({ products, horizonDays }: Props) {
  const suggestions = useMemo(
    () => products.filter(isPriceChange).sort((a, b) => profitGain(b) - profitGain(a)),
    [products],
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Cambios de Precio Sugeridos</h2>
          <p className="text-gray-500 font-medium">
            Rebajas que aumentan la ganancia esperada en {horizonDays} días por demanda, rotación o caducidad.
            Nunca por debajo del costo más un 5 %.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        {suggestions.length === 0 ? (
          <div className="py-16 text-center text-gray-400 italic">
            No hay cambios de precio sugeridos: los precios actuales ya maximizan la ganancia esperada con los datos disponibles.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <tr>
                  <th className="px-5 py-4 text-left">Producto</th>
                  <th className="px-4 py-4 text-right">Precio</th>
                  <th className="px-4 py-4 text-right">Margen</th>
                  <th className="px-4 py-4 text-right" title="Variación de volumen esperada frente al volumen necesario para ganar lo mismo">
                    Volumen vs. equilibrio
                  </th>
                  <th className="px-4 py-4 text-right">Caducidad</th>
                  <th className="px-5 py-4 text-right">Ganancia extra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {suggestions.map((p) => {
                  const pricing = p.pricing;
                  const expected = pricing.expected_volume_change_pct;
                  const breakeven = pricing.breakeven_volume_change_pct;
                  const clearsBreakeven = expected !== null && breakeven !== null && expected >= breakeven;
                  return (
                    <tr key={p.product_id} className="hover:bg-gray-50/60">
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">{p.name}</span>
                          <span className="text-[10px] font-black text-gray-400">{p.abc}{p.xyz}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                            {ACTION_LABELS[pricing.action]}
                          </span>
                          <span className="text-xs text-gray-500">{pricing.reason}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right align-top whitespace-nowrap">
                        <div className="text-gray-400 line-through text-xs">{money(pricing.current_price)}</div>
                        <div className="font-black text-gray-900">{money(pricing.suggested_price)}</div>
                        <div className="text-xs font-bold text-rose-500 inline-flex items-center gap-0.5">
                          <ArrowDownRight className="h-3 w-3" />{pct(pricing.change_pct, 1)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right align-top whitespace-nowrap text-xs">
                        <div className="text-gray-500">{pct(pricing.current_margin_pct, 1).replace('+', '')}</div>
                        <div className="font-bold text-gray-900">→ {pct(pricing.new_margin_pct, 1).replace('+', '')}</div>
                      </td>
                      <td className="px-4 py-4 text-right align-top whitespace-nowrap text-xs">
                        <div className="font-bold text-gray-900">{pct(expected)} esperado</div>
                        <div className="text-gray-500">{breakeven === null ? '—' : `${pct(breakeven)} necesario`}</div>
                        {breakeven !== null && (
                          <div className={`mt-1 inline-flex items-center gap-1 font-bold ${clearsBreakeven ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {clearsBreakeven ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            {clearsBreakeven ? 'Supera el equilibrio' : 'Se justifica por caducidad'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right align-top whitespace-nowrap text-xs">
                        {p.expiry.days_to_earliest_expiry !== null ? (
                          <>
                            <div className="inline-flex items-center gap-1 font-bold text-gray-900">
                              <Clock className="h-3 w-3" />{p.expiry.days_to_earliest_expiry} días
                            </div>
                            <div className="text-gray-500">
                              {pricing.units_at_risk_current.toFixed(0)} → {pricing.units_at_risk_new.toFixed(0)} uds. en riesgo
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right align-top whitespace-nowrap">
                        <div className="font-black text-emerald-600 inline-flex items-center gap-1">
                          <TrendingUp className="h-4 w-4" />{money(profitGain(p))}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          Elasticidad {p.elasticity.value.toFixed(2)} ({p.elasticity.source === 'data' ? 'datos' : 'conservadora'})
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
