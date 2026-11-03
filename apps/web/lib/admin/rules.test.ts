import { describe, expect, it } from 'vitest';
import {
  adminAccess,
  canSeeAdminLink,
  normalizeAdminPhone,
  parseAdminPhones,
} from './rules';

describe('normalizeAdminPhone', () => {
  it('accepts the canonical 11-digit mobile', () => {
    expect(normalizeAdminPhone('09123456789')).toBe('09123456789');
  });

  it('normalizes +98, 0098, 98 and the bare 10-digit form', () => {
    expect(normalizeAdminPhone('+989123456789')).toBe('09123456789');
    expect(normalizeAdminPhone('00989123456789')).toBe('09123456789');
    expect(normalizeAdminPhone('989123456789')).toBe('09123456789');
    expect(normalizeAdminPhone('9123456789')).toBe('09123456789');
  });

  it('folds Persian digits and separators', () => {
    expect(normalizeAdminPhone('۰۹۱۲ ۳۴۵ ۶۷۸۹')).toBe('09123456789');
    expect(normalizeAdminPhone('0912-345-6789')).toBe('09123456789');
  });

  it('rejects anything that is not an Iranian mobile', () => {
    expect(normalizeAdminPhone('02112345678')).toBe('');
    expect(normalizeAdminPhone('not-a-phone')).toBe('');
    expect(normalizeAdminPhone('09123')).toBe('');
  });
});

describe('parseAdminPhones', () => {
  it('returns an empty list for an unset value', () => {
    expect(parseAdminPhones(undefined)).toEqual([]);
    expect(parseAdminPhones('')).toEqual([]);
    expect(parseAdminPhones(' , ')).toEqual([]);
  });

  it('splits on commas and whitespace, canonicalizes and de-duplicates', () => {
    expect(parseAdminPhones('+989123456789, 09121234567\n00989121234567')).toEqual([
      '09123456789',
      '09121234567',
    ]);
  });

  it('drops unparseable entries instead of failing the whole list', () => {
    expect(parseAdminPhones('02112345678,09123456789')).toEqual(['09123456789']);
  });
});

describe('adminAccess', () => {
  const list = ['09123456789'];

  it('treats a guest as a guest even in demo mode', () => {
    expect(adminAccess(null, list, true)).toBe('guest');
    expect(adminAccess(undefined, [], false)).toBe('guest');
  });

  it('allows an allow-listed phone in a hosted deployment', () => {
    expect(adminAccess('09123456789', list, false)).toBe('admin');
  });

  it('normalizes the session phone before matching', () => {
    expect(adminAccess('+989123456789', list, false)).toBe('admin');
  });

  it('refuses a signed-in stranger in a hosted deployment', () => {
    expect(adminAccess('09129999999', list, false)).toBe('forbidden');
  });

  it('lets any signed-in account moderate in demo/fixture mode', () => {
    expect(adminAccess('09129999999', [], true)).toBe('admin');
  });

  it('only advertises the link to admins', () => {
    expect(canSeeAdminLink('admin')).toBe(true);
    expect(canSeeAdminLink('forbidden')).toBe(false);
    expect(canSeeAdminLink('guest')).toBe(false);
  });
});
