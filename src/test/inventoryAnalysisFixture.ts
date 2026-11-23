import type { InventoryAnalysisOut, ProductAnalysisOut } from '../client/types.gen'

export function productFixture(overrides: Partial<ProductAnalysisOut> = {}): ProductAnalysisOut {
  return {
    product_id: 'p-keep',
    name: 'Clavos',
    sku: 'CLV',
    category: 'Ferretería',
    abc: 'C',
    xyz: 'Z',
    price: 2,
    cost: 1,
    stock: 100,
    stock_value_cost: 100,
    perishability: 'NONE',
    shelf_life_days: null,
    days_observed: 90,
    units_sold: 0,
    revenue: 0,
    daily_demand: 0,
    daily_demand_std: 0,
    weekly_cv: null,
    coverage_days: null,
    turnover_annual: 0,
    is_dead_stock: true,
    elasticity: { value: -1.5, source: 'default', weeks_used: 0 },
    expiry: { units_at_risk: 0, expired_now: 0, earliest_expiry: null, days_to_earliest_expiry: null, unknown_age_units: 100 },
    restock: { eoq: 0, safety_stock: 0, reorder_point: 0, days_until_empty: null, days_until_reorder: null, capped_by_shelf_life: false },
    pricing: {
      action: 'keep', reason: 'Sin riesgo', current_price: 2, suggested_price: 2, change_pct: 0,
      expected_daily_demand: 0, expected_volume_change_pct: 0, breakeven_volume_change_pct: 0,
      current_margin_pct: 50, new_margin_pct: 50, current_horizon_profit: -1, expected_horizon_profit: -1,
      units_at_risk_current: 0, units_at_risk_new: 0,
    },
    ...overrides,
  }
}

export const chicken = productFixture({
  product_id: 'p-chicken',
  name: 'Pollo entero',
  sku: 'POL',
  category: 'Carnes',
  abc: 'A',
  xyz: 'X',
  price: 5,
  cost: 3,
  stock: 40,
  stock_value_cost: 120,
  perishability: 'FRESH',
  shelf_life_days: 10,
  units_sold: 56,
  revenue: 280,
  daily_demand: 2,
  coverage_days: 20,
  turnover_annual: 18.25,
  is_dead_stock: false,
  expiry: { units_at_risk: 32, expired_now: 0, earliest_expiry: '2026-11-27', days_to_earliest_expiry: 4, unknown_age_units: 0 },
  restock: { eoq: 20, safety_stock: 1.5, reorder_point: 7.5, days_until_empty: 20, days_until_reorder: 16.2, capped_by_shelf_life: true },
  pricing: {
    action: 'markdown', reason: 'Rebaja para vender antes del vencimiento', current_price: 5, suggested_price: 4,
    change_pct: -20, expected_daily_demand: 2.79, expected_volume_change_pct: 39.75,
    breakeven_volume_change_pct: 100, current_margin_pct: 40, new_margin_pct: 25,
    current_horizon_profit: -80, expected_horizon_profit: -56.7, units_at_risk_current: 32, units_at_risk_new: 28.8,
  },
})

export const yogurt = productFixture({
  product_id: 'p-yogurt',
  name: 'Yogur',
  abc: 'B',
  xyz: 'Y',
  price: 3,
  cost: 2,
  perishability: 'SHORT',
  shelf_life_days: 30,
  revenue: 90,
  daily_demand: 1,
  is_dead_stock: false,
  pricing: {
    action: 'markdown', reason: 'Rebaja para vender antes del vencimiento', current_price: 3,
    suggested_price: 2.1, change_pct: -30, expected_daily_demand: 1.7, expected_volume_change_pct: 70,
    breakeven_volume_change_pct: 900, current_margin_pct: 33.3, new_margin_pct: 4.8,
    current_horizon_profit: -150, expected_horizon_profit: -60, units_at_risk_current: 75, units_at_risk_new: 40,
  },
})

export const analysisFixture: InventoryAnalysisOut = {
  generated_on: '2026-11-23',
  branch: { id: 'branch-1', name: 'Sucursal Centro' },
  params: { window_days: 90, horizon_days: 60 },
  summary: {
    products: 3, stock_value_cost: 420, stock_value_price: 700, revenue: 370, dead_stock_count: 1,
    dead_stock_value: 100, unclassified_count: 0, units_at_risk: 107, value_at_risk: 246,
    suggestions_count: 2, expected_profit_gain: 113.3, top20_revenue_share: 0.76,
  },
  products: [productFixture(), chicken, yogurt],
  methodology: [
    { topic: 'Demanda diaria', detail: 'Media móvil exponencial.' },
    { topic: 'Precio sugerido', detail: 'Maximiza la ganancia esperada.' },
  ],
}
