import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  instantOtpAllowedFor,
  instantOtpEmergencyAllowedFor,
  instantOtpFallbackAllowedFor,
  sandboxOtpFallbackEnabled,
} from '../apps/web/lib/config/mode';

const ENV_KEYS = [
  'NODE_ENV',
  'AUTH_SECRET',
  'INSTANT_OTP_ALLOWLIST',
  'SMS_API_KEY',
  'SMS_SENDER',
  'SMS_API_URL',
  'SMS_IR_API_KEY',
  'SMS_IR_TEMPLATE_ID',
  'ALLOW_SANDBOX_OTP_FALLBACK',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;
const saved = new Map<string, string | undefined>();

function setEnv(key: (typeof ENV_KEYS)[number], value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

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

describe('production instant OTP gate', () => {
  it('blocks every number when no allowlist is configured', () => {
    setEnv('NODE_ENV', 'production');
    setEnv('AUTH_SECRET', 'production-secret-at-least-16-chars');
    setEnv('INSTANT_OTP_ALLOWLIST', undefined);

    expect(instantOtpAllowedFor('09120000001')).toBe(false);
    expect(instantOtpAllowedFor('+989120000002')).toBe(false);
  });

  it('allows only normalized launch numbers from the explicit allowlist', () => {
    setEnv('NODE_ENV', 'production');
    setEnv('AUTH_SECRET', 'production-secret-at-least-16-chars');
    setEnv('INSTANT_OTP_ALLOWLIST', '+98 912 000 0001, 0935-123-4567; not-a-phone');

    expect(instantOtpAllowedFor('09120000001')).toBe(true);
    expect(instantOtpAllowedFor('+989120000001')).toBe(true);
    expect(instantOtpAllowedFor('09351234567')).toBe(true);
    expect(instantOtpAllowedFor('09120000002')).toBe(false);
  });

  it('disables instant OTP entirely once an SMS provider is configured', () => {
    setEnv('NODE_ENV', 'production');
    setEnv('AUTH_SECRET', 'production-secret-at-least-16-chars');
    setEnv('INSTANT_OTP_ALLOWLIST', '09120000001');
    setEnv('SMS_API_KEY', 'key');
    setEnv('SMS_SENDER', '1000');
    setEnv('SMS_API_URL', 'https://sms.example');

    expect(instantOtpAllowedFor('09120000001')).toBe(false);
  });

  it('keeps the unrestricted instant flow in development only', () => {
    setEnv('NODE_ENV', 'test');
    setEnv('INSTANT_OTP_ALLOWLIST', undefined);

    expect(instantOtpAllowedFor('09120000099')).toBe(true);
  });

  it('keeps the flag-gated fallback off by default', () => {
    setEnv('NODE_ENV', 'production');
    setEnv('INSTANT_OTP_ALLOWLIST', '09120000001');
    setEnv('SMS_IR_API_KEY', 'sms-ir-key');
    setEnv('SMS_IR_TEMPLATE_ID', '123456');

    expect(sandboxOtpFallbackEnabled()).toBe(false);
    expect(instantOtpFallbackAllowedFor('09120000001')).toBe(false);
  });

  it('lets exactly the allowlist take the on-screen code when the gateway fails', () => {
    setEnv('NODE_ENV', 'production');
    setEnv('INSTANT_OTP_ALLOWLIST', '+98 912 000 0001, 0935-123-4567');
    setEnv('SMS_IR_API_KEY', 'sms-ir-key');
    setEnv('SMS_IR_TEMPLATE_ID', '123456');

    expect(instantOtpEmergencyAllowedFor('09120000001')).toBe(true);
    expect(instantOtpEmergencyAllowedFor('+989120000001')).toBe(true);
    expect(instantOtpEmergencyAllowedFor('09351234567')).toBe(true);
    // No wildcard: a number the operator did not list still gets nothing.
    expect(instantOtpEmergencyAllowedFor('09120000099')).toBe(false);
  });

  it('has no emergency path when the allowlist is empty', () => {
    setEnv('NODE_ENV', 'production');
    setEnv('INSTANT_OTP_ALLOWLIST', undefined);
    setEnv('SMS_IR_API_KEY', 'sms-ir-key');
    setEnv('SMS_IR_TEMPLATE_ID', '123456');

    expect(instantOtpEmergencyAllowedFor('09120000001')).toBe(false);
  });

  it('also keeps the sandbox fallback off in development without the flag', () => {
    setEnv('NODE_ENV', 'development');
    setEnv('INSTANT_OTP_ALLOWLIST', '09120000001');

    expect(instantOtpFallbackAllowedFor('09120000001')).toBe(false);
    // The separate no-provider instant path is unchanged in development.
    expect(instantOtpAllowedFor('09120000099')).toBe(true);
  });

  it('opens the fallback only for allowlisted numbers once the flag is set', () => {
    setEnv('NODE_ENV', 'production');
    setEnv('ALLOW_SANDBOX_OTP_FALLBACK', 'true');
    setEnv('INSTANT_OTP_ALLOWLIST', '09120000001');

    expect(sandboxOtpFallbackEnabled()).toBe(true);
    expect(instantOtpFallbackAllowedFor('09120000001')).toBe(true);
    expect(instantOtpFallbackAllowedFor('+989120000001')).toBe(true);
    expect(instantOtpFallbackAllowedFor('09120000002')).toBe(false);
  });

  it('does not open the fallback for every number when the allowlist is empty', () => {
    setEnv('NODE_ENV', 'production');
    setEnv('ALLOW_SANDBOX_OTP_FALLBACK', 'yes');
    setEnv('INSTANT_OTP_ALLOWLIST', undefined);

    expect(instantOtpFallbackAllowedFor('09120000001')).toBe(false);
  });

  it('reports the legacy switch on /api/health while it is on', async () => {
    setEnv('NODE_ENV', 'production');
    setEnv('AUTH_SECRET', 'production-secret-at-least-16-chars');
    setEnv('INSTANT_OTP_ALLOWLIST', '09120000001');
    setEnv('ALLOW_SANDBOX_OTP_FALLBACK', 'true');

    const { GET } = await import('../apps/web/app/api/health/route');
    const body = await (await GET()).json();

    expect(body.checks.sandboxFallback).toMatchObject({ enabled: true, allowlistCount: 1 });
    expect(body.warnings?.[0]).toMatch(/ALLOW_SANDBOX_OTP_FALLBACK/);
  });

  it('warns about the allowlist boundary while a provider is configured', async () => {
    setEnv('NODE_ENV', 'production');
    setEnv('AUTH_SECRET', 'production-secret-at-least-16-chars');
    setEnv('INSTANT_OTP_ALLOWLIST', '09120000001');
    setEnv('SMS_IR_API_KEY', 'sms-ir-key');
    setEnv('SMS_IR_TEMPLATE_ID', '123456');
    setEnv('ALLOW_SANDBOX_OTP_FALLBACK', undefined);

    const { GET } = await import('../apps/web/app/api/health/route');
    const body = await (await GET()).json();

    expect(body.checks.sandboxFallback).toMatchObject({
      enabled: false,
      automatic: true,
      allowlistCount: 1,
    });
    expect(body.warnings?.some((warning: string) => /INSTANT_OTP_ALLOWLIST/.test(warning))).toBe(
      true,
    );
  });

  it('rejects an unlisted phone at the OTP endpoint and returns no code', async () => {
    setEnv('NODE_ENV', 'production');
    setEnv('AUTH_SECRET', 'production-secret-at-least-16-chars');
    setEnv('INSTANT_OTP_ALLOWLIST', '09120000001');
    setEnv('SMS_API_KEY', undefined);
    setEnv('SMS_SENDER', undefined);
    setEnv('SMS_API_URL', undefined);

    const { POST } = await import('../apps/web/app/api/auth/otp/route');
    const response = await POST(
      new Request('http://localhost/api/auth/otp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.91',
        },
        body: JSON.stringify({ phone: '09120000002' }),
      }),
    );

    expect(response.status).toBe(403);
    const body = (await response.json()) as { devCode?: string; demoCode?: string };
    expect(body.devCode).toBeUndefined();
    expect(body.demoCode).toBeUndefined();
  });

  it('also rejects an unlisted phone at the verification endpoint', async () => {
    setEnv('NODE_ENV', 'production');
    setEnv('AUTH_SECRET', 'production-secret-at-least-16-chars');
    setEnv('INSTANT_OTP_ALLOWLIST', '09120000001');
    setEnv('SMS_API_KEY', undefined);
    setEnv('SMS_SENDER', undefined);
    setEnv('SMS_API_URL', undefined);

    const { POST } = await import('../apps/web/app/api/auth/verify/route');
    const response = await POST(
      new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: '09120000002', code: '123456' }),
      }),
    );

    expect(response.status).toBe(403);
  });
});
