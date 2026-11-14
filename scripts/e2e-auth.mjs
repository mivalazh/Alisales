#!/usr/bin/env node
/**
 * Deployed-preview auth smoke test.
 *
 *   npm run auth:e2e -- --url=https://<preview-host> --phone=0912...
 *
 * The script drives the real HTTP auth flow:
 *   request OTP -> verify SMS code -> read the session -> logout.
 *
 * It deliberately fails if the deployment returns `demoCode`, accepts the demo
 * sign-in route, or issues a non-HttpOnly/non-Secure session cookie. The SMS
 * code is never printed or baked into the command line; set E2E_OTP_CODE or
 * enter it at the prompt.
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

function arg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function fail(message) {
  throw new Error(message);
}

async function post(base, path, body, cookie) {
  return fetch(new URL(path, base), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
    redirect: 'manual',
  });
}

async function main() {
  const base = (arg('url') ?? process.env.E2E_BASE_URL ?? '').replace(/\/$/, '');
  if (!/^https?:\/\//.test(base)) {
    fail('Pass the deployed preview with --url=https://... (or E2E_BASE_URL).');
  }

  const demo = await fetch(new URL('/api/auth/demo?next=/', base), {
    redirect: 'manual',
  });
  if (demo.status !== 404) {
    fail(`Demo sign-in is still enabled (expected 404, got ${demo.status}).`);
  }

  const interactive = createInterface({ input: stdin, output: stdout });
  try {
    let phone = arg('phone') ?? process.env.E2E_TEST_PHONE ?? '';
    if (!phone) phone = (await interactive.question('Test mobile number: ')).trim();
    if (!phone) fail('A test mobile number is required.');

    const otp = await post(base, '/api/auth/otp', { phone });
    const otpBody = await otp.json().catch(() => ({}));
    if (otp.status !== 202) {
      fail(
        `OTP request failed (${otp.status}): ${String(otpBody.error ?? 'no error body')}`,
      );
    }
    if (otpBody.demoCode !== undefined) {
      fail('OTP response exposed a demo code; production cutover is not complete.');
    }

    let code = process.env.E2E_OTP_CODE?.trim() ?? '';
    if (!code) {
      code = (await interactive.question('SMS code: ')).trim();
    }
    if (!code) fail('The SMS code is required.');

    const verifyBody = {
      phone,
      code,
      ...(otpBody.needsProfile
        ? {
            displayName: process.env.E2E_DISPLAY_NAME?.trim() || 'E2E Auth Test',
            accountType: process.env.E2E_ACCOUNT_TYPE?.trim() || 'individual',
          }
        : {}),
    };
    const verify = await post(base, '/api/auth/verify', verifyBody);
    const verified = await verify.json().catch(() => ({}));
    if (verify.status !== 200) {
      fail(
        `OTP verification failed (${verify.status}): ${String(
          verified.error ?? 'no error body',
        )}`,
      );
    }

    const cookies = verify.headers.getSetCookie?.() ?? [];
    const sessionCookie = cookies.find((value) => value.startsWith('alisales_session='));
    if (!sessionCookie) fail('Sign-in succeeded but no session cookie was issued.');
    const lower = sessionCookie.toLowerCase();
    if (!lower.includes('httponly')) fail('Session cookie is missing HttpOnly.');
    if (!lower.includes('samesite=lax')) fail('Session cookie is missing SameSite=Lax.');
    if (base.startsWith('https://') && !lower.includes('secure')) {
      fail('Session cookie is missing Secure on an HTTPS deployment.');
    }
    const cookieHeader = sessionCookie.split(';')[0];

    const me = await fetch(new URL('/api/auth/me', base), {
      headers: { cookie: cookieHeader },
      redirect: 'manual',
    });
    const meBody = await me.json().catch(() => ({}));
    if (me.status !== 200 || typeof meBody.user?.id !== 'string') {
      fail(`Session check failed (${me.status}).`);
    }

    const logout = await post(base, '/api/auth/logout', {}, cookieHeader);
    if (logout.status !== 200) fail(`Logout failed (${logout.status}).`);
    const after = await fetch(new URL('/api/auth/me', base), {
      headers: { cookie: cookieHeader },
      redirect: 'manual',
    });
    if (after.status !== 401) fail(`Session survived logout (${after.status}).`);

    console.log(
      JSON.stringify(
        {
          ok: true,
          base,
          accountType: meBody.user.accountType,
          demoRouteDisabled: true,
          sessionCookie: 'HttpOnly/SameSite=Lax/Secure',
          loggedOut: true,
        },
        null,
        2,
      ),
    );
  } finally {
    interactive.close();
  }
}

main().catch((error) => {
  console.error(`\nAuth E2E failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
