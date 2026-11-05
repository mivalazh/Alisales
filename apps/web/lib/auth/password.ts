import { readJson, writeJson } from '../storage/demo-store';
import { normalizePhone } from '@alisales/schemas';

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
 * Storage: Supabase's `users` table has no password column and touching the
 * schema is out of scope, so the hash lives in the demo credential store. In a
 * hosted deployment that store is isolate memory — a password set on one
 * isolate may not be visible on the next, which is exactly why the SMS path
 * remains the guaranteed way in. `setAccountPassword` also writes the password
 * into Supabase Auth when the account exists there, so a hosted project with
 * `SUPABASE_ANON_KEY` verifies through Supabase itself.
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
