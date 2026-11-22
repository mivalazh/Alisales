import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Route-level proof of the on-screen OTP fallback boundary.
 *
 * The provider is configured (so the app is in its "real SMS" branch) and the
 * gateway answers with a sandbox/unverified rejection. The fallback is
 * automatic: a number on INSTANT_OTP_ALLOWLIST gets the code on screen and can
 * complete the login with no switch involved, while a number outside the list
 * receives nothing. The legacy ALLOW_SANDBOX_OTP_FALLBACK flag cannot widen
 * that boundary — the second block shows it changes nothing for the allowlist
 * — so the list itself is the account-takeover boundary. The signed cookie
 * also has to carry the code across isolates. Everything is exercised through
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
const { deleteOtp, getOtp } = await import('../apps/web/lib/auth/otp-store');
const { demoOtpCookieMatches } = await import('../apps/web/lib/auth/otp-cookie');

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
  // The legacy flag stays unset: the fallback must work without it.
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

describe('SMS.ir failure opens the code for allowlisted launch numbers', () => {
  it('returns 200 with fallbackCode when the provider rejects the account', async () => {
    const fetchMock = sandboxRejection();

    const response = await requestOtp(
      post('/api/auth/otp', { phone: PHONE }, '203.0.113.10'),
    );
    const body = (await response.json()) as {
      ok?: boolean;
      delivery?: string;
      warning?: string;
      fallbackCode?: string;
      devCode?: string;
      demoCode?: string;
    };

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.delivery).toBe('instant');
    expect(body.fallbackCode).toMatch(/^\d{6}$/);
    expect(body.devCode).toBe(body.fallbackCode);
    expect(body.warning).toBe('SMS_IR_TEMPLATE_NOT_APPROVED');
    // The code is handed to this browser in a signed cookie too, so verify works
    // on another isolate. Assert it matches this code, not merely that one exists.
    expect(body.fallbackCode).toBeTruthy();
    expect(await demoOtpCookieMatches(PHONE, body.fallbackCode as string)).toBe(true);
  });

  it('completes the login without the legacy flag', async () => {
    sandboxRejection();

    const issued = await requestOtp(
      post('/api/auth/otp', { phone: PHONE }, '203.0.113.16'),
    );
    const { fallbackCode } = (await issued.json()) as { fallbackCode: string };
    expect(issued.status).toBe(200);
    expect(fallbackCode).toMatch(/^\d{6}$/);

    const verified = await verifyOtp(
      post(
        '/api/auth/verify',
        {
          phone: PHONE,
          code: fallbackCode,
          displayName: 'لانچ بدون فلگ',
          accountType: 'individual',
        },
        '203.0.113.16',
      ),
    );
    const body = (await verified.json()) as { ok?: boolean; user?: { displayName?: string } };

    expect(verified.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.user?.displayName).toBe('لانچ بدون فلگ');
    expect([...jar.keys()].some((name) => name.includes('session'))).toBe(true);
  });

  it('never writes a production code to the server log', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      sandboxRejection();

      const response = await requestOtp(
        post('/api/auth/otp', { phone: PHONE }, '203.0.113.18'),
      );
      const { fallbackCode } = (await response.json()) as { fallbackCode: string };
      expect(response.status).toBe(200);
      expect(fallbackCode).toMatch(/^\d{6}$/);

      const logged = log.mock.calls.map((call) => String(call[0])).join('\n');
      // The browser still gets the code; the log must not carry a replayable one.
      expect(logged).toContain('code not logged in production');
      expect(logged).not.toContain(fallbackCode);
    } finally {
      log.mockRestore();
    }
  });

  it('accepts the signed cookie when another isolate lost the record', async () => {
    sandboxRejection();

    const issued = await requestOtp(
      post('/api/auth/otp', { phone: PHONE }, '203.0.113.17'),
    );
    const { fallbackCode } = (await issued.json()) as { fallbackCode: string };
    expect(issued.status).toBe(200);

    // Simulate a different isolate: the in-memory record is gone, only the
    // cookie survives. This is the path the emergency allowlist must cover.
    deleteOtp(PHONE);
    expect(getOtp(PHONE)).toBeNull();

    const verified = await verifyOtp(
      post(
        '/api/auth/verify',
        {
          phone: PHONE,
          code: fallbackCode,
          displayName: 'کوکی ایزوله',
          accountType: 'individual',
        },
        '203.0.113.17',
      ),
    );

    expect(verified.status).toBe(200);
  });

  it('still issues nothing for a number outside the allowlist', async () => {
    process.env.INSTANT_OTP_ALLOWLIST = '';
    sandboxRejection();

    const response = await requestOtp(
      post('/api/auth/otp', { phone: PHONE }, '203.0.113.15'),
    );
    const body = (await response.json()) as {
      code?: string;
      fallbackCode?: string;
      devCode?: string;
    };

    expect(response.status).toBe(503);
    expect(body.code).toBe('SMS_IR_TEMPLATE_NOT_APPROVED');
    expect(body.fallbackCode).toBeUndefined();
    expect(body.devCode).toBeUndefined();
    expect([...jar.keys()]).toEqual([]);
  });

  it('names a missing provider instead of a gateway error', async () => {
    delete process.env.SMS_IR_API_KEY;
    delete process.env.SMS_IR_TEMPLATE_ID;

    const response = await requestOtp(
      post('/api/auth/otp', { phone: PHONE }, '203.0.113.18'),
    );
    const body = (await response.json()) as { warning?: string; fallbackCode?: string };

    // No provider is not a provider failure; the code still opens for the
    // allowlisted launch number, with the accurate warning.
    expect(response.status).toBe(200);
    expect(body.fallbackCode).toMatch(/^\d{6}$/);
    expect(body.warning).toBe('SMS_NOT_CONFIGURED');
  });

  it('keeps the demo code working in development without an allowlist', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.SMS_IR_API_KEY;
    delete process.env.SMS_IR_TEMPLATE_ID;
    process.env.INSTANT_OTP_ALLOWLIST = '';

    const response = await requestOtp(
      post('/api/auth/otp', { phone: '09120000077' }, '203.0.113.19'),
    );
    const body = (await response.json()) as { warning?: string; devCode?: string };

    // Regression guard: demo mode used to be refused once the allowlist stopped
    // being the only gate; local sign-in must still show its code.
    expect(response.status).toBe(200);
    expect(body.devCode).toMatch(/^\d{6}$/);
    expect(body.warning).toBe('SMS_NOT_CONFIGURED');
  });

  it('rejects a wrong code at verify', async () => {
    sandboxRejection();

    const issued = await requestOtp(
      post('/api/auth/otp', { phone: PHONE }, '203.0.113.11'),
    );
    expect(issued.status).toBe(200);

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

    // The code exists and does not match, so verify refuses the attempt.
    expect(verified.status).toBe(401);
    expect(body.ok).toBeUndefined();
    expect([...jar.keys()].filter((name) => name.includes('session'))).toEqual([]);
  });
});

describe('the legacy flag never widens the allowlist boundary', () => {
  it('keeps issuing the allowlisted code while the flag is set', async () => {
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

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.delivery).toBe('instant');
    expect(body.devCode).toMatch(/^\d{6}$/);
    expect(body.demoCode).toBe(body.devCode);
    expect(body.warning).toBe('SMS_IR_TEMPLATE_NOT_APPROVED');
  });

  it('still refuses an unlisted number while the flag is set', async () => {
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

  it('completes login while the flag is set', async () => {
    process.env.ALLOW_SANDBOX_OTP_FALLBACK = 'true';
    sandboxRejection();

    const issued = await requestOtp(
      post('/api/auth/otp', { phone: PHONE }, '203.0.113.14'),
    );
    const { devCode } = (await issued.json()) as { devCode: string };
    expect(issued.status).toBe(200);
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
