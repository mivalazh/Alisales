import { cookies } from 'next/headers';
import { authSecret } from './session';

/**
 * Demo-only OTP hand-off, carried by a signed cookie.
 *
 * Why this exists: on the hosted preview the app runs on Workers with no
 * filesystem, so the OTP store is *isolate memory*. Two requests from the same
 * visitor are routinely served by different isolates, and then the code that
 * was just issued "does not exist" at the verify step — login dead-ends on a
 * preview link with no console access.
 *
 * The fix is stateless and scoped to demo auth only (`demoAuthMode()`: fixture
 * data, no SMS provider): `/api/auth/otp` also returns the code in an
 * httpOnly, SameSite=Lax cookie signed with the session secret, and
 * `/api/auth/verify` accepts it when the in-memory record is missing. The code
 * is still short-lived (10 minutes) and still bound to the phone number.
 *
 * Hosted deployments never set this cookie: with an SMS provider configured the
 * normal store path applies, and a real code is never echoed into a cookie.
 */
export const DEMO_OTP_COOKIE = 'alisales_demo_otp';

/** Minimum lifetime of a delivered demo code. */
const TTL_MS = 10 * 60 * 1000;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

/** Constant-time compare (values are short). */
function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Stores `phone:code:expiry` plus its HMAC for the verify step. */
export async function setDemoOtpCookie(phone: string, code: string): Promise<void> {
  const secret = authSecret();
  if (!secret) return;
  const expiresAt = Date.now() + TTL_MS;
  const payload = `${phone}:${code}:${expiresAt}`;
  const value = `${encodeURIComponent(payload)}.${await sign(secret, payload)}`;
  const jar = await cookies();
  jar.set(DEMO_OTP_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(TTL_MS / 1000),
  });
}

/** True when the cookie holds this phone/code and has not expired. */
export async function demoOtpCookieMatches(phone: string, code: string): Promise<boolean> {
  const secret = authSecret();
  if (!secret) return false;
  const jar = await cookies();
  const raw = jar.get(DEMO_OTP_COOKIE)?.value;
  if (!raw) return false;
  const [encoded, signature] = raw.split('.');
  if (!encoded || !signature) return false;
  let payload: string;
  try {
    payload = decodeURIComponent(encoded);
  } catch {
    return false;
  }
  if (!equal(signature, await sign(secret, payload))) return false;
  const [storedPhone, storedCode, expiry] = payload.split(':');
  if (!storedPhone || !storedCode || !expiry) return false;
  if (Number(expiry) <= Date.now()) return false;
  return storedPhone === phone && storedCode === code;
}

export async function clearDemoOtpCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(DEMO_OTP_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
}
