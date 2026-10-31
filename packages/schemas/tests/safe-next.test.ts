import { describe, expect, it } from 'vitest';
import { loginHref, safeNextPath } from '../src/safe-next';

describe('safeNextPath — internal paths pass through', () => {
  it('keeps the root path', () => {
    expect(safeNextPath('/')).toBe('/');
  });

  it('keeps nested paths with a query string', () => {
    expect(safeNextPath('/new')).toBe('/new');
    expect(safeNextPath('/chats/abc?tab=visit')).toBe('/chats/abc?tab=visit');
    expect(safeNextPath('/profile/listings?page=2#top')).toBe('/profile/listings?page=2#top');
  });

  it('trims surrounding whitespace before accepting a path', () => {
    expect(safeNextPath('  /favorites  ')).toBe('/favorites');
  });
});

describe('safeNextPath — open redirects fall back to /', () => {
  it('rejects an absolute http(s) URL', () => {
    expect(safeNextPath('https://evil.com')).toBe('/');
    expect(safeNextPath('http://evil.com/login')).toBe('/');
  });

  it('rejects a protocol-relative //host', () => {
    expect(safeNextPath('//evil.com')).toBe('/');
    expect(safeNextPath('//evil.com/path')).toBe('/');
  });

  it('rejects a javascript: URL', () => {
    expect(safeNextPath('javascript:alert(1)')).toBe('/');
    expect(safeNextPath('JaVaScRiPt:alert(1)')).toBe('/');
  });

  it('rejects a backslash that browsers read as a slash', () => {
    expect(safeNextPath('/\\evil.com')).toBe('/');
    expect(safeNextPath('/%5Cevil.com')).toBe('/');
    expect(safeNextPath('/%2F%2Fevil.com')).toBe('/');
  });

  it('rejects a relative path with no leading slash', () => {
    expect(safeNextPath('evil.com')).toBe('/');
    expect(safeNextPath('new')).toBe('/');
  });

  it('rejects missing, empty and oversized values', () => {
    expect(safeNextPath(undefined)).toBe('/');
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath('')).toBe('/');
    expect(safeNextPath(`/${'a'.repeat(600)}`)).toBe('/');
  });

  it('honours a custom fallback', () => {
    expect(safeNextPath('https://evil.com', '/profile')).toBe('/profile');
  });
});

describe('loginHref', () => {
  it('encodes a sanitized next path', () => {
    expect(loginHref('/new')).toBe('/login?next=%2Fnew');
    expect(loginHref('/chats/abc?tab=visit')).toBe('/login?next=%2Fchats%2Fabc%3Ftab%3Dvisit');
  });

  it('never forwards an external URL', () => {
    expect(loginHref('https://evil.com')).toBe('/login?next=%2F');
    expect(loginHref('//evil.com')).toBe('/login?next=%2F');
    expect(loginHref('javascript:alert(1)')).toBe('/login?next=%2F');
  });
});
