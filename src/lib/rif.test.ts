import { describe, it, expect } from 'vitest';
import { isValidRif, normalizeRif } from './rif';

describe('isValidRif', () => {
  it('accepts a RIF whose check digit computes to a non-zero value', () => {
    expect(isValidRif('J-00123072-6')).toBe(true);
  });

  it('accepts a RIF that exercises the remainder-10-collapses-to-0 branch', () => {
    expect(isValidRif('J-00002961-0')).toBe(true);
  });

  it('rejects a wrong check digit', () => {
    expect(isValidRif('J-00123072-5')).toBe(false);
  });

  it('rejects the C prefix even with an otherwise correct check digit', () => {
    expect(isValidRif('C-00123072-6')).toBe(false);
  });

  it('rejects a short digit body', () => {
    expect(isValidRif('J-0012307-6')).toBe(false);
  });

  it('rejects an unsupported letter', () => {
    expect(isValidRif('X-00002961-0')).toBe(false);
  });

  it('treats null as always valid — required-ness lives outside the validator', () => {
    expect(isValidRif(null)).toBe(true);
  });
});

describe('normalizeRif', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeRif('  J-00123072-6  ')).toBe('J-00123072-6');
  });

  it('upper-cases a lowercase input', () => {
    expect(normalizeRif('j-00123072-6')).toBe('J-00123072-6');
  });

  it('normalizes whitespace-only input to null, never an empty string', () => {
    expect(normalizeRif('   ')).toBeNull();
  });

  it('normalizes empty string input to null', () => {
    expect(normalizeRif('')).toBeNull();
  });
});
