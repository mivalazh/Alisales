import { describe, expect, it } from 'vitest';
import {
  formatAmountLatin,
  formatPriceLatin,
  groupLatinDigits,
  toLatinDigits,
} from '../src/digits';

describe('toLatinDigits', () => {
  it('converts Persian digits', () => {
    expect(toLatinDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
  });

  it('converts Arabic-Indic digits', () => {
    expect(toLatinDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
  });

  it('leaves Latin digits, letters and separators untouched', () => {
    expect(toLatinDigits('0912 345-6789 km')).toBe('0912 345-6789 km');
  });

  it('mixes scripts in one value', () => {
    expect(toLatinDigits('سال ۱۴۰۴ / 1404')).toBe('سال 1404 / 1404');
  });
});

describe('groupLatinDigits', () => {
  it('groups thousands with ASCII commas', () => {
    expect(groupLatinDigits(1_250_000)).toBe('1,250,000');
    expect(groupLatinDigits(999)).toBe('999');
    expect(groupLatinDigits(0)).toBe('0');
  });

  it('keeps a negative sign', () => {
    expect(groupLatinDigits(-1_500)).toBe('-1,500');
  });

  it('truncates fractional input and survives non-finite values', () => {
    expect(groupLatinDigits(12_345.9)).toBe('12,345');
    expect(groupLatinDigits(Number.NaN)).toBe('0');
    expect(groupLatinDigits(Number.POSITIVE_INFINITY)).toBe('0');
  });
});

describe('price formatting', () => {
  it('formats amounts without a unit', () => {
    expect(formatAmountLatin(2_400_000)).toBe('2,400,000');
  });

  it('formats a ریال price with Latin digits', () => {
    expect(formatPriceLatin(1_100_000_000_000)).toBe('1,100,000,000,000 ریال');
    expect(formatPriceLatin(0)).toBe('0 ریال');
  });

  it('never emits Persian digits', () => {
    expect(/[۰-۹]/.test(formatPriceLatin(987_654_321))).toBe(false);
  });
});
