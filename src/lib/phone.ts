/**
 * Venezuelan phone number normalization.
 *
 * The app is single-market, so the country code is fixed at 58. The national
 * significant number is always 10 digits: a 3-digit operator/area code starting
 * with 4 (mobile) or 2 (landline), followed by 7 subscriber digits.
 *
 * Users write the same number in three ways, and all three must normalize to
 * one canonical value:
 *
 *   +58 412-1234567  ->  +584121234567
 *   0412-1234567     ->  +584121234567
 *   412 1234567      ->  +584121234567
 *
 * The leading 0 is the national trunk prefix and is mutually exclusive with the
 * country code — it has to be dropped before 58 is prepended, otherwise the
 * result is +5804121234567, which WhatsApp rejects.
 */

const COUNTRY_CODE = '58';
const NATIONAL_NUMBER_LENGTH = 10;

/** Mobile codes start with 4, landline area codes with 2. */
const NATIONAL_NUMBER_PREFIX = /^[24]/;

/**
 * Normalizes any accepted input format to E.164 (`+584121234567`).
 * Returns `null` when the value is empty or cannot be a Venezuelan number.
 * Idempotent: an already-normalized value normalizes to itself.
 */
export function normalizeVenezuelanPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const digits = raw.replace(/\D/g, '');
  let nationalNumber: string;

  if (
    digits.length === COUNTRY_CODE.length + NATIONAL_NUMBER_LENGTH &&
    digits.startsWith(COUNTRY_CODE)
  ) {
    nationalNumber = digits.slice(COUNTRY_CODE.length);
  } else if (digits.length === NATIONAL_NUMBER_LENGTH + 1 && digits.startsWith('0')) {
    nationalNumber = digits.slice(1);
  } else if (digits.length === NATIONAL_NUMBER_LENGTH) {
    nationalNumber = digits;
  } else {
    return null;
  }

  if (!NATIONAL_NUMBER_PREFIX.test(nationalNumber)) return null;

  return `+${COUNTRY_CODE}${nationalNumber}`;
}

/**
 * Returns the digits-only form wa.me expects (country code, no `+`),
 * or `null` when the stored value is not a usable Venezuelan number.
 */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  const normalized = normalizeVenezuelanPhone(raw);
  return normalized ? normalized.slice(1) : null;
}
