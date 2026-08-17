/**
 * Venezuelan RIF (Registro de Información Fiscal) validation.
 *
 * Mirrors the backend's SENIAT mod-11 check-digit algorithm exactly
 * (`rack-backend/apps/organization/validators.py`) so the two layers never
 * disagree about what counts as a valid RIF.
 *
 * Required-ness is intentionally NOT enforced here: `Company.rif` stays
 * nullable in the database so the migration never blocks a deploy, and the
 * backend only enforces presence at the onboarding endpoint. `null` is
 * therefore always valid to this validator — required-ness belongs in the
 * wizard's own Zod schema.
 */

const RIF_PATTERN = /^([VEJPG])-(\d{8})-(\d)$/;

const LETTER_WEIGHTS: Record<string, number> = { V: 1, E: 2, J: 3, P: 4, G: 5 };
const LETTER_MULTIPLIER = 4;
const DIGIT_WEIGHTS = [3, 2, 7, 6, 5, 4, 3, 2];

/**
 * Trims and upper-cases the input. Whitespace-only or empty input normalizes
 * to `null`, NEVER `""` — an empty string is a value that can collide under
 * the database's unique constraint, `NULL` cannot.
 */
export function normalizeRif(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed === '') return null;
  return trimmed.toUpperCase();
}

/**
 * `null` is always valid — required-ness is enforced elsewhere.
 * Otherwise: structure `^[VEJPG]-\d{8}-\d$` followed by the mod-11
 * check-digit rule, with a remainder of 10 collapsing to 0.
 */
export function isValidRif(value: string | null): boolean {
  if (value === null) return true;

  const match = RIF_PATTERN.exec(value);
  if (!match) return false;

  const [, letter, digits, checkDigitStr] = match;
  const providedCheckDigit = Number(checkDigitStr);

  let total = LETTER_WEIGHTS[letter] * LETTER_MULTIPLIER;
  for (let i = 0; i < DIGIT_WEIGHTS.length; i++) {
    total += Number(digits[i]) * DIGIT_WEIGHTS[i];
  }

  let expectedCheckDigit = 11 - (total % 11);
  if (expectedCheckDigit > 9) expectedCheckDigit = 0;

  return providedCheckDigit === expectedCheckDigit;
}
