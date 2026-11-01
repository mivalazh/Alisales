import { cookies } from 'next/headers';
import type { AccountType } from '@alisales/schemas';
import { DEMO_AUTH_SECRET, fixtureMode } from '../config/mode';

/**
 * Stateless session cookies (S2 / C4).
 *
 * Format: `base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload))`.
 * The payload carries the account id, phone, display name and account type —
 * never a password, an OTP or anything secret. Verification is constant-time
 * and always checks the expiry.
 *
 * Web Crypto is used instead of `node:crypto` so the same code runs in Node
 * and in the Workers runtime that hosts the app.
 */

export const SESSION_COOKIE = 'alisales_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  sub: string;
  phone: string;
  displayName: string;
  accountType: AccountType;
  /** Expiry, epoch ms. */
  exp: number;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * The signing secret. In production a missing AUTH_SECRET disables sessions
 * (routes answer 503) rather than falling back to a known value — except in a
 * fixture/demo deployment (no hosted data credentials), where a clearly
 * labelled demo secret keeps the preview usable. Development uses the same
 * fixed local secret so a fresh checkout works without setup.
 */
export function authSecret(): string | null {
  const configured = process.env.AUTH_SECRET;
  if (configured && configured.length >= 16) return configured;
  if (process.env.NODE_ENV !== 'production') return DEMO_AUTH_SECRET;
  if (fixtureMode()) return DEMO_AUTH_SECRET;
  return null;
}

export async function hmacSha256(secret: string, value: string): Promise<string> {
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

/** Constant-time string equality (length is not secret here). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(
  user: Omit<SessionUser, 'exp'>,
  now: number = Date.now(),
): Promise<string> {
  const secret = authSecret();
  if (!secret) throw new Error('AUTH_SECRET is not configured');
  const payload: SessionUser = { ...user, exp: now + SESSION_TTL_MS };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${body}.${await hmacSha256(secret, body)}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
  now: number = Date.now(),
): Promise<SessionUser | null> {
  const secret = authSecret();
  if (!secret || !token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = await hmacSha256(secret, body);
  if (!safeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionUser;
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.phone !== 'string' ||
      typeof payload.exp !== 'number' ||
      payload.exp <= now
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/** Current request's session, or null for guests. */
export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}
