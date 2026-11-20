import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../apps/web/app/api/health/route';
import { authSecret, authSecretReadiness } from '../apps/web/lib/auth/session';
import { smsReadiness } from '../apps/web/lib/auth/sms';

// This file covers the login/secret checks. The database and storage
// round-trips need a live Supabase project, so they are proven in
// tests/health-data-path.test.ts with a fake client.
vi.mock('@/lib/health/data-probes', () => ({
  dataPathChecks: async () => ({
    database: { ok: true, table: 'health_probes', roundTripMs: 1 },
    storage: { ok: true, bucket: 'listing-photos', roundTripMs: 1 },
  }),
}));

const ENV_KEYS = [
  'NODE_ENV',
  'AUTH_SECRET',
  'INSTANT_OTP_ALLOWLIST',
  'SMS_IR_API_KEY',
  'SMS_IR_TEMPLATE_ID',
  'SMS_API_KEY',
  'SMS_SENDER',
  'SMS_API_URL',
] as const;

const saved = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved.set(key, process.env[key]);
    if (key !== 'NODE_ENV') delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = saved.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  saved.clear();
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

  it('accepts a production secret and an allowlisted instant path', async () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_SECRET = '1234567890abcdef';
    process.env.INSTANT_OTP_ALLOWLIST = '09120000001';

    expect(authSecretReadiness()).toEqual({ ok: true, source: 'configured' });
    expect(authSecret()).toBe('1234567890abcdef');
    expect(smsReadiness()).toMatchObject({ configured: false, provider: null });

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      checks: {
        authSecret: { ok: true, source: 'configured' },
        sms: { configured: false, provider: null },
        instantOtp: { ready: true, allowlistCount: 1 },
        login: { ok: true, mode: 'instant-allowlist' },
      },
    });
  });

  it('fails readiness when a secret exists but no login path does', async () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_SECRET = '1234567890abcdef';

    const response = await GET();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      checks: {
        authSecret: { ok: true },
        login: { ok: false, code: 'SMS_NOT_CONFIGURED' },
      },
    });
  });

  it('names a missing SMS.ir template instead of reporting a generic failure', async () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_SECRET = '1234567890abcdef';
    process.env.SMS_IR_API_KEY = 'sms-ir-key';

    const response = await GET();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      checks: {
        sms: {
          configured: false,
          provider: 'sms_ir',
          missing: ['SMS_IR_TEMPLATE_ID'],
          templateIdConfigured: false,
        },
        login: { ok: false, code: 'SMS_IR_TEMPLATE_ID_MISSING' },
      },
    });
  });

  it('keeps the local fallback outside production only', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.AUTH_SECRET;

    expect(authSecretReadiness()).toEqual({ ok: true, source: 'development-fallback' });
    expect(authSecret()).toBe('alisales-demo-secret-not-for-production');
  });
});
