import { cookies } from 'next/headers';
import { OTP_MAX_ATTEMPTS, OTP_TTL_MS } from '@alisales/schemas';
import { authSecret } from './session';
import { hashOtpCode } from './otp-store';

/**
 * Signed OTP challenge, carried by an httpOnly cookie.
 *
 * Why this exists: on a serverless host (Vercel) every request may be served by
 * a different instance, so the OTP store — isolate memory there — cannot be
 * trusted to remember a code between `/api/auth/otp` and `/api/auth/verify`.
 * "کد تأیید یافت نشد" is exactly that failure.
 *
 * The challenge cookie makes verification stateless: it carries the phone, the
 * HMAC hash of the code, its expiry and the attempt count, signed with
 * AUTH_SECRET. The code itself is never stored in the cookie, so reading it
 * does not reveal what the user has to type, and it cannot be replayed for
 * another number or after the expiry.
 *
 * The cookie is issued for every code (SMS or on-screen), not only for the
 * demo/allowlist fallback, so a real SMS login also survives a cold instance.
 */
export const OTP_CHALLENGE_COOKIE = 'alisales_otp_challenge';
/** Cleared on sign-out of the challenge; old builds wrote a plaintext code here. */
const LEGACY_DEMO_OTP_COOKIE = 'alisales_demo_otp';

export interface OtpChallenge {
  phone: string;
  /** HMAC-SHA256 of `otp:phone:code` — the only form the code is kept in. */
  codeHash: string;
  expiresAt: number;
  attempts: number;
}

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

function encode(challenge: OtpChallenge): string {
  return `${challenge.phone}:${challenge.codeHash}:${challenge.expiresAt}:${challenge.attempts}`;
}

async function write(challenge: OtpChallenge): Promise<void> {
  const secret = authSecret();
  if (!secret) return;
  const payload = encode(challenge);
  const value = `${encodeURIComponent(payload)}.${await sign(secret, payload)}`;
  const jar = await cookies();
  jar.set(OTP_CHALLENGE_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.ceil(OTP_TTL_MS / 1000),
  });
}

/** Store the challenge for the code that was just issued. */
export async function setOtpChallenge(challenge: OtpChallenge): Promise<void> {
  await write(challenge);
}

/** True when the cookie holds a valid, unexpired challenge for `phone`. */
export async function readOtpChallenge(phone: string): Promise<OtpChallenge | null> {
  const secret = authSecret();
  if (!secret) return null;
  const jar = await cookies();
  const raw = jar.get(OTP_CHALLENGE_COOKIE)?.value;
  if (!raw) return null;
  const [encoded, signature] = raw.split('.');
  if (!encoded || !signature) return null;
  let payload: string;
  try {
    payload = decodeURIComponent(encoded);
  } catch {
    return null;
  }
  if (!equal(signature, await sign(secret, payload))) return null;
  const [storedPhone, codeHash, expiry, attempts] = payload.split(':');
  if (!storedPhone || !codeHash || !expiry || attempts === undefined) return null;
  if (storedPhone !== phone) return null;
  return {
    phone: storedPhone,
    codeHash,
    expiresAt: Number(expiry),
    attempts: Number(attempts),
  };
}

/** Persist one more wrong attempt on the cookie (bounded by the policy). */
export async function bumpOtpChallenge(challenge: OtpChallenge): Promise<OtpChallenge> {
  const next: OtpChallenge = {
    ...challenge,
    attempts: Math.min(OTP_MAX_ATTEMPTS, challenge.attempts + 1),
  };
  await write(next);
  return next;
}

/**
 * True when `code` hashes to the challenge stored in this browser's cookie.
 * The code is hashed here, so the cookie never carries it.
 */
export async function otpChallengeMatches(phone: string, code: string): Promise<boolean> {
  const challenge = await readOtpChallenge(phone);
  if (!challenge) return false;
  const hash = await hashOtpCode(phone, code);
  return equal(hash, challenge.codeHash);
}

export async function clearOtpChallenge(): Promise<void> {
  const jar = await cookies();
  for (const name of [OTP_CHALLENGE_COOKIE, LEGACY_DEMO_OTP_COOKIE]) {
    jar.delete(name);
  }
}
