import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { instantOtpAllowedFor } from '../apps/web/lib/config/mode';

const ENV_KEYS = [
  'NODE_ENV',
  'AUTH_SECRET',
  'INSTANT_OTP_ALLOWLIST',
  'SMS_API_KEY',
  'SMS_SENDER',
  'SMS_API_URL',
  'SMS_IR_API_KEY',
  'SMS_IR_TEMPLATE_ID',
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
