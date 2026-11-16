import { createClient } from '@supabase/supabase-js';
import { readJson, writeJson } from '../storage/demo-store';
import { normalizePhone } from '@alisales/schemas';
import { admin } from '../data/s2-store';

/**
 * Optional password login, next to the SMS code.
 *
 * The OTP stays the primary door (it proves the phone is yours); a password is
 * what makes the second visit instant — no waiting for an SMS, no code to type
 * while the seller is on the phone.
 *
 * Hashing is PBKDF2-SHA256 with a random 16-byte salt and 120,000 iterations,
 * done with Web Crypto so the same code runs on Node and on Workers. The format
 * is `pbkdf2$<iterations>$<salt>$<hash>`, all base64url.
 *
 * Storage: hosted accounts write the password to Supabase Auth itself (the
 * durable source across Worker isolates), with `password_set` in user metadata
 * so settings can show the real state without a schema change. The local hash
 * remains the fixture-mode store and the immediate fallback when a deployment
 * has no Supabase credentials. The SMS path stays available either way.
 */

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
const ITERATIONS = 120_000;

const FILE = 'passwords.json';

interface PasswordRow {
  phone: string;
  hash: string;
  updatedAt: string;
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
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return toBase64Url(new Uint8Array(bits));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64Url(salt)}$${hash}`;
}

export async function verifyPasswordHash(password: string, stored: string): Promise<boolean> {
  const [scheme, rawIterations, rawSalt, rawHash] = stored.split('$');
  if (scheme !== 'pbkdf2' || !rawIterations || !rawSalt || !rawHash) return false;
  const iterations = Number(rawIterations);
  if (!Number.isFinite(iterations) || iterations < 10_000) return false;
  try {
    const hash = await derive(password, fromBase64Url(rawSalt), iterations);
    // Constant-time-ish comparison over equal-length strings.
    if (hash.length !== rawHash.length) return false;
    let diff = 0;
    for (let i = 0; i < hash.length; i += 1) diff |= hash.charCodeAt(i) ^ rawHash.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}

/** «حداقل ۸ نویسه، با حرف و رقم» — the message, or null when acceptable. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `رمز عبور باید حداقل ${PASSWORD_MIN} نویسه باشد.`;
  if (password.length > PASSWORD_MAX) return 'رمز عبور بیش از حد بلند است.';
  if (!/[A-Za-z\u0600-\u06FF]/.test(password) || !/[0-9]/.test(password)) {
    return 'رمز عبور باید هم حرف و هم رقم داشته باشد.';
  }
  return null;
}

function readRows(): PasswordRow[] {
  const rows = readJson<PasswordRow[]>(FILE, () => []);
  return Array.isArray(rows) ? rows : [];
}

export function hasPassword(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return readRows().some((row) => row.phone === normalized && Boolean(row.hash));
}

/** Stores (or replaces) the demo credential hash for a phone number. */
export function savePasswordHash(phone: string, hash: string): void {
  const normalized = normalizePhone(phone);
  const rows = readRows().filter((row) => row.phone !== normalized);
  rows.push({ phone: normalized, hash, updatedAt: new Date().toISOString() });
  writeJson(FILE, rows);
}

/** Verifies against the demo credential store. */
export async function verifyStoredPassword(phone: string, password: string): Promise<boolean> {
  const normalized = normalizePhone(phone);
  const row = readRows().find((entry) => entry.phone === normalized);
  if (!row) return false;
  return verifyPasswordHash(password, row.hash);
}

/**
 * Persists a password for a real account. Supabase Auth is authoritative in a
 * hosted deployment; the local hash keeps fixture mode and local previews
 * working. Returns false only when a hosted write was attempted and failed.
 */
export async function saveAccountPassword(
  accountId: string,
  phone: string,
  password: string,
): Promise<boolean> {
  const hash = await hashPassword(password);
  const sb = admin();
  if (!sb) {
    savePasswordHash(phone, hash);
    return true;
  }
  try {
    const existing = await sb.auth.admin.getUserById(accountId);
    const metadata = {
      ...((existing.data.user?.user_metadata ?? {}) as Record<string, unknown>),
      password_set: true,
    };
    const { error } = await sb.auth.admin.updateUserById(accountId, {
      password,
      user_metadata: metadata,
    });
    if (error) {
      console.warn('[alisales] auth password update failed:', error.message);
      return false;
    }
    savePasswordHash(phone, hash);
    return true;
  } catch (error) {
    console.warn('[alisales] auth password update unavailable:', error);
    return false;
  }
}

/** Whether this account already has a durable password. */
export async function hasAccountPassword(
  accountId: string,
  phone: string,
): Promise<boolean> {
  if (hasPassword(phone)) return true;
  const sb = admin();
  if (!sb) return false;
  try {
    const { data } = await sb.auth.admin.getUserById(accountId);
    const metadata = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
    return metadata.password_set === true;
  } catch (error) {
    console.warn('[alisales] auth password state unavailable:', error);
    return false;
  }
}

/**
 * Verifies a password across isolates: local hash first, then Supabase Auth.
 * Supabase's sign-in is used only as a verifier; its session is discarded and
 * the app keeps issuing its own signed cookie.
 */
export async function verifyAccountPassword(
  phone: string,
  password: string,
): Promise<boolean> {
  if (await verifyStoredPassword(phone, password)) return true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return false;
  try {
    const sb = createClient(url, anon, { auth: { persistSession: false } });
    const normalized = normalizePhone(phone);
    const e164 = normalized.startsWith('0') ? `+98${normalized.slice(1)}` : normalized;
    const { error } = await sb.auth.signInWithPassword({ phone: e164, password });
    return !error;
  } catch (error) {
    console.warn('[alisales] hosted password verification unavailable:', error);
    return false;
  }
}

/** Simple in-memory throttle: 8 wrong tries per phone per 15 minutes. */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 8;

export function passwordAttemptsExceeded(phone: string): boolean {
  const entry = attempts.get(normalizePhone(phone));
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    attempts.delete(normalizePhone(phone));
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function notePasswordFailure(phone: string): void {
  const key = normalizePhone(phone);
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: Date.now() });
    return;
  }
  entry.count += 1;
}

export function clearPasswordFailures(phone: string): void {
  attempts.delete(normalizePhone(phone));
}
