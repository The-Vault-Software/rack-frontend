import type { PerishabilityEnum } from '../client/types.gen';

// Mirrors apps/inventory/models.py (Perishability, DEFAULT_SHELF_LIFE_DAYS).
// The backend fills the same defaults when no days are sent; the form uses
// these to show the reference and to reset the days when the class changes.
export const PERISHABILITY_OPTIONS: {
  value: PerishabilityEnum;
  label: string;
  defaultDays: number | null;
  examples: string;
}[] = [
  { value: 'NONE', label: 'Sin caducidad', defaultDays: null, examples: 'ferretería, envases, limpieza' },
  { value: 'LONG', label: 'Larga (~1 año)', defaultDays: 365, examples: 'enlatados, granos, pasta' },
  { value: 'MEDIUM', label: 'Media (~4 meses)', defaultDays: 120, examples: 'lácteos larga vida, galletas' },
  { value: 'SHORT', label: 'Corta (~1 mes)', defaultDays: 30, examples: 'pan empacado, quesos' },
  { value: 'FRESH', label: 'Fresco (~10 días)', defaultDays: 10, examples: 'pollo, carne, verduras' },
];

export function perishabilityLabel(value: string | null | undefined): string {
  if (!value) return 'Sin clasificar';
  return PERISHABILITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function defaultShelfLifeDays(value: string | null | undefined): number | null {
  return PERISHABILITY_OPTIONS.find((o) => o.value === value)?.defaultDays ?? null;
}

// The generated type is `PerishabilityEnum | BlankEnum | NullEnum`, and the
// generator emits NullEnum as `unknown`, which swallows the union. Narrow it
// back to the string the form works with ('' = not classified).
export function perishabilityFormValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
