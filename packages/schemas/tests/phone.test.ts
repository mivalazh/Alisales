import { describe, expect, it } from 'vitest';
import { isValidMobile, maskPhone, normalizePhone } from '../src/phone';

describe('normalizePhone', () => {
  it('accepts a local number as-is', () => {
    expect(normalizePhone('09123456789')).toBe('09123456789');
  });

  it('converts Persian and Arabic-Indic digits', () => {
    expect(normalizePhone('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
    expect(normalizePhone('٠٩١٢٣٤٥٦٧٨٩')).toBe('09123456789');
  });

  it('strips spaces, dashes and parentheses', () => {
    expect(normalizePhone('0912 345 6789')).toBe('09123456789');
    expect(normalizePhone('0912-345-6789')).toBe('09123456789');
    expect(normalizePhone('(0912) 345 6789')).toBe('09123456789');
  });

  it('normalizes every country-code prefix to 09…', () => {
    expect(normalizePhone('+989123456789')).toBe('09123456789');
    expect(normalizePhone('+98 912 345 6789')).toBe('09123456789');
    expect(normalizePhone('00989123456789')).toBe('09123456789');
    expect(normalizePhone('989123456789')).toBe('09123456789');
    expect(normalizePhone('9123456789')).toBe('09123456789');
  });

  it('is idempotent', () => {
    const once = normalizePhone('+98 912 345 6789');
    expect(normalizePhone(once)).toBe(once);
  });
});

describe('isValidMobile', () => {
  it('accepts canonical Iranian mobiles in any supported input form', () => {
    expect(isValidMobile('09123456789')).toBe(true);
    expect(isValidMobile('+98 912 345 6789')).toBe(true);
    expect(isValidMobile('۰۹۱۲۳۴۵۶۷۸۹')).toBe(true);
  });

  it('rejects landlines, short numbers and letters', () => {
    expect(isValidMobile('0212345678')).toBe(false);
    expect(isValidMobile('0912345678')).toBe(false);
    expect(isValidMobile('091234567890')).toBe(false);
    expect(isValidMobile('0912abc6789')).toBe(false);
    expect(isValidMobile('')).toBe(false);
  });
});

describe('maskPhone', () => {
  it('shows only the prefix and last four digits', () => {
    expect(maskPhone('09123456789')).toBe('0912***6789');
    expect(maskPhone('+98 912 345 6789')).toBe('0912***6789');
  });

  it('returns a dash for an invalid number', () => {
    expect(maskPhone('12345')).toBe('—');
  });
});
