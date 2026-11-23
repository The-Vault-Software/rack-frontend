import { describe, it, expect } from 'vitest'
import { analysisFixture } from '../test/inventoryAnalysisFixture'
import {
  buildMethodologyRows,
  buildProductRows,
  buildSuggestionRows,
  buildSummaryRows,
} from './inventoryAnalysisExport'

describe('inventory analysis export', () => {
  it('lists only price changes, largest profit gain first', () => {
    const rows = buildSuggestionRows(analysisFixture)
    // Yogurt gains 90, chicken 23.3; the kept product is left out.
    expect(rows.map((r) => r['Producto'])).toEqual(['Yogur', 'Pollo entero'])
    expect(rows.every((r) => r['Acción'] === 'Rebajar')).toBe(true)
    expect(rows[0]['Ganancia adicional (USD)']).toBe(90)
  })

  it('keeps numbers numeric so the sheet can be sorted and summed', () => {
    const [, chickenRow] = buildSuggestionRows(analysisFixture)
    expect(chickenRow['Precio sugerido (USD)']).toBe(4)
    expect(chickenRow['Volumen necesario para equilibrio (%)']).toBe(100)
    expect(chickenRow['Caducidad']).toBe('Fresco (~10 días)')
    expect(chickenRow['Vence en (días)']).toBe(4)
  })

  it('never exports a suggested price under cost plus 5%', () => {
    for (const row of buildSuggestionRows(analysisFixture)) {
      expect(row['Precio sugerido (USD)'] as number).toBeGreaterThanOrEqual((row['Costo (USD)'] as number) * 1.05 - 1e-9)
    }
  })

  it('ranks every product by revenue in the product sheet', () => {
    const rows = buildProductRows(analysisFixture)
    expect(rows.map((r) => r['Producto'])).toEqual(['Pollo entero', 'Yogur', 'Clavos'])
    expect(rows[2]['Stock muerto']).toBe('Sí')
  })

  it('summarises and carries the server methodology verbatim', () => {
    const summary = Object.fromEntries(buildSummaryRows(analysisFixture).map((r) => [r.Indicador, r.Valor]))
    expect(summary['Sucursal']).toBe('Sucursal Centro')
    expect(summary['Ganancia adicional esperada en 60 días (USD)']).toBe(113.3)
    expect(summary['Ingresos concentrados en el 20 % de productos']).toBe(76)
    expect(buildMethodologyRows(analysisFixture)).toEqual([
      { Tema: 'Demanda diaria', Detalle: 'Media móvil exponencial.' },
      { Tema: 'Precio sugerido', Detalle: 'Maximiza la ganancia esperada.' },
    ])
  })
})
