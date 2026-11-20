import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Route-level proof that the sandbox/on-screen OTP fallback is closed.
 *
 * The provider is configured (so the app is in its "real SMS" branch) and the
 * gateway answers with a sandbox/unverified rejection. Without
 * ALLOW_SANDBOX_OTP_FALLBACK the OTP route must not hand out a code and verify
 * must refuse anything typed in; with the flag on, an allowlisted launch number
 * completes the login. This is the account-takeover boundary, tested through
 * the HTTP handlers rather than the helper functions.
 */

const jar = vi.hoisted(() => new Map<string, string>());

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name) as string } : undefined,
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
}));

const { POST: requestOtp } = await import('../apps/web/app/api/auth/otp/route');
const { POST: verifyOtp } = await import('../apps/web/app/api/auth/verify/route');

const PHONE = '09120000001';
const ALLOWLISTED = '09120000001';

const ENV_KEYS = [
  'NODE_ENV',
  'AUTH_SECRET',
  'INSTANT_OTP_ALLOWLIST',
  'ALLOW_SANDBOX_OTP_FALLBACK',
  'SMS_IR_API_KEY',
  'SMS_IR_TEMPLATE_ID',
  'SMS_API_KEY',
  'SMS_SENDER',
  'SMS_API_URL',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DEMO_DATA_DIR',
] as const;

const saved = new Map<string, string | undefined>();
let dataDir = '';

function post(path: string, body: unknown, ip: string): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

/** SMS.ir answering "this account/template is not verified" before delivery. */
function sandboxRejection(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ status: 0, message: 'sandbox: account not verified' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved.set(key, process.env[key]);
    delete process.env[key];
  }
  jar.clear();
  dataDir = mkdtempSync(join(tmpdir(), 'alisales-otp-fallback-'));
  process.env.DEMO_DATA_DIR = dataDir;

  process.env.NODE_ENV = 'production';
  process.env.AUTH_SECRET = 'production-secret-at-least-16-chars';
  process.env.INSTANT_OTP_ALLOWLIST = ALLOWLISTED;
  process.env.SMS_IR_API_KEY = 'sms-ir-key';
  process.env.SMS_IR_TEMPLATE_ID = '123456';
  // The flag under test stays unset here.
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ENV_KEYS) {
    const value = saved.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  saved.clear();
  jar.clear();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  dataDir = '';
});

describe('sandbox OTP fallback is closed by default', () => {
  it('returns no code when the provider rejects a sandbox account', async () => {
    const fetchMock = sandboxRejection();

    const response = await requestOtp(
      post('/api/auth/otp', { phone: PHONE }, '203.0.113.10'),
    );
    const body = (await response.json()) as {
      code?: string;
      devCode?: string;
      demoCode?: string;
    };

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(503);
    expect(body.code).toBe('SMS_IR_TEMPLATE_NOT_APPROVED');
    expect(body.devCode).toBeUndefined();
    expect(body.demoCode).toBeUndefined();
    // Nothing was handed to the browser either.
    expect([...jar.keys()]).toEqual([]);
  });

  it('rejects any on-screen code at verify while the flag is off', async () => {
    sandboxRejection();

    const issued = await requestOtp(
      post('/api/auth/otp', { phone: PHONE }, '203.0.113.11'),
    );
    expect(issued.status).toBe(503);

    const verified = await verifyOtp(
      post(
        '/api/auth/verify',
        {
          phone: PHONE,
          code: '123456',
          displayName: 'تست',
          accountType: 'individual',
        },
        '203.0.113.11',
      ),
    );
    const body = (await verified.json()) as { ok?: boolean; error?: string };

    expect(verified.status).toBe(400);
    expect(body.ok).toBeUndefined();
    expect([...jar.keys()].filter((name) => name.includes('session'))).toEqual([]);
  });
});

describe('sandbox OTP fallback opens only for the allowlist when enabled', () => {
  it('issues an allowlisted code with the flag on', async () => {
    process.env.ALLOW_SANDBOX_OTP_FALLBACK = 'true';
    sandboxRejection();

    const response = await requestOtp(
      post('/api/auth/otp', { phone: PHONE }, '203.0.113.12'),
    );
    const body = (await response.json()) as {
      ok?: boolean;
      delivery?: string;
      devCode?: string;
      demoCode?: string;
      warning?: string;
    };

    expect(response.status).toBe(202);
    expect(body.ok).toBe(true);
    expect(body.delivery).toBe('instant');
    expect(body.devCode).toMatch(/^\d{6}$/);
    expect(body.demoCode).toBe(body.devCode);
    expect(body.warning).toBe('SMS_IR_TEMPLATE_NOT_APPROVED');
  });

  it('still refuses an unlisted number with the flag on', async () => {
    process.env.ALLOW_SANDBOX_OTP_FALLBACK = 'true';
    sandboxRejection();

    const response = await requestOtp(
      post('/api/auth/otp', { phone: '09120000099' }, '203.0.113.13'),
    );
    const body = (await response.json()) as { devCode?: string; code?: string };

    expect(response.status).toBe(503);
    expect(body.code).toBe('SMS_IR_TEMPLATE_NOT_APPROVED');
    expect(body.devCode).toBeUndefined();
  });

  it('completes login with the on-screen code once the flag is on', async () => {
    process.env.ALLOW_SANDBOX_OTP_FALLBACK = 'true';
    sandboxRejection();

    const issued = await requestOtp(
      post('/api/auth/otp', { phone: PHONE }, '203.0.113.14'),
    );
    const { devCode } = (await issued.json()) as { devCode: string };
    expect(issued.status).toBe(202);
    expect(devCode).toMatch(/^\d{6}$/);

    const verified = await verifyOtp(
      post(
        '/api/auth/verify',
        {
          phone: PHONE,
          code: devCode,
          displayName: 'فروشنده تست',
          accountType: 'individual',
        },
        '203.0.113.14',
      ),
    );
    const body = (await verified.json()) as {
      ok?: boolean;
      user?: { displayName?: string };
    };

    expect(verified.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.user?.displayName).toBe('فروشنده تست');
    // The real session cookie is what makes this a completed login.
    expect([...jar.keys()].some((name) => name.includes('session'))).toBe(true);
  });
});
