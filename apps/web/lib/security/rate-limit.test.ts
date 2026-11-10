import { describe, expect, it } from 'vitest';
import { rateLimit } from './rate-limit';

function request(ip: string): Request {
  return new Request('https://example.test/api', {
    headers: { 'x-forwarded-for': ip },
  });
}

describe('rateLimit', () => {
  it('allows requests up to the limit and blocks the next one', () => {
    const options = {
      request: request('198.51.100.10'),
      bucket: 'test-limit',
      limit: 2,
      windowMs: 60_000,
    };

    expect(rateLimit(options).ok).toBe(true);
    expect(rateLimit(options).ok).toBe(true);

    const blocked = rateLimit(options);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('keeps separate identities in separate windows', () => {
    const base = { bucket: 'test-identities', limit: 1, windowMs: 60_000 };
    expect(rateLimit({ ...base, request: request('198.51.100.20') }).ok).toBe(true);
    expect(rateLimit({ ...base, request: request('198.51.100.21') }).ok).toBe(true);
  });

  it('prefers an authenticated user key over the address', () => {
    const base = {
      request: request('198.51.100.30'),
      bucket: 'test-user-key',
      limit: 1,
      windowMs: 60_000,
    };
    expect(rateLimit({ ...base, key: 'user-a' }).ok).toBe(true);
    expect(rateLimit({ ...base, key: 'user-a' }).ok).toBe(false);
    expect(rateLimit({ ...base, key: 'user-b' }).ok).toBe(true);
  });
});
