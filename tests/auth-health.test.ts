import { afterEach, describe, expect, it } from 'vitest';
import { GET } from '../apps/web/app/api/health/route';
import { authSecret, authSecretReadiness } from '../apps/web/lib/auth/session';

const savedNodeEnv = process.env.NODE_ENV;
const savedSecret = process.env.AUTH_SECRET;

afterEach(() => {
  if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = savedNodeEnv;
  if (savedSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = savedSecret;
});

describe('AUTH_SECRET readiness', () => {
  it('reports a missing production secret and keeps signing disabled', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.AUTH_SECRET;

    expect(authSecretReadiness()).toEqual({ ok: false, reason: 'missing' });
    expect(authSecret()).toBeNull();

    const response = await GET();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      checks: { authSecret: { ok: false, code: 'AUTH_SECRET_MISSING' } },
    });
  });

  it('reports a too-short production secret without exposing its value', async () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_SECRET = 'short-secret';

    expect(authSecretReadiness()).toEqual({ ok: false, reason: 'too_short' });
    expect(authSecret()).toBeNull();

    const response = await GET();
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({
      ok: false,
      checks: { authSecret: { ok: false, code: 'AUTH_SECRET_TOO_SHORT' } },
    });
    expect(text).not.toContain('short-secret');
  });

  it('accepts a production secret of at least 16 characters', async () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_SECRET = '1234567890abcdef';

    expect(authSecretReadiness()).toEqual({ ok: true, source: 'configured' });
    expect(authSecret()).toBe('1234567890abcdef');

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      checks: { authSecret: { ok: true, source: 'configured' } },
    });
  });

  it('keeps the local fallback outside production only', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.AUTH_SECRET;

    expect(authSecretReadiness()).toEqual({ ok: true, source: 'development-fallback' });
    expect(authSecret()).toBe('alisales-demo-secret-not-for-production');
  });
});
