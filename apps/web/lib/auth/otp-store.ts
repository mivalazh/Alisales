import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  otpResendWaitSeconds,
} from '@alisales/schemas';
import { authSecret, hmacSha256 } from './session';
import { demoDataDir, fixtureMode } from '../config/mode';

/**
 * OTP storage (S2 / C4).
 *
 * Codes are stored ONLY as an HMAC-SHA256 hash, never in clear text. A record
 * carries its expiry, attempt count and last send time. Development persists
 * records to `.dev-data/otp.json` because Next keeps a separate module graph
 * per route (request and verify would otherwise not share memory). That holds
 * for a fixture/demo deployment too — including a production preview build —
 * which is exactly why the store is file-backed in fixture mode. A hosted
 * production deployment keeps them in isolate memory and requires a real SMS
 * provider.
 *
 * The generated code is returned to the caller for delivery only — it must
 * never be serialized into an HTTP response.
 */

export interface OtpRecord {
  phone: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

const memory = new Map<string, OtpRecord>();

function storeFile(): string {
  return join(demoDataDir(), 'otp.json');
}

function fileBacked(): boolean {
  // Development and fixture/demo deployments persist to disk; a hosted
  // production deployment uses isolate memory (a real provider sends the code).
  return process.env.NODE_ENV !== 'production' || fixtureMode();
}

function readAll(): Record<string, OtpRecord> {
  try {
    const file = storeFile();
    if (!existsSync(file)) return {};
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, OtpRecord>) : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, OtpRecord>): void {
  const dir = demoDataDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'otp.json'), `${JSON.stringify(all, null, 2)}\n`, 'utf8');
}

/** Six digits from a cryptographic RNG (rejection sampling, no modulo bias). */
export function generateOtp(): string {
  let code = '';
  while (code.length < OTP_LENGTH) {
    const byte = new Uint8Array(1);
    crypto.getRandomValues(byte);
    if (byte[0]! < 250) code += String(byte[0]! % 10);
  }
  return code;
}

async function hashCode(phone: string, code: string): Promise<string> {
  const secret = authSecret();
  if (!secret) throw new Error('AUTH_SECRET is not configured');
  return hmacSha256(secret, `otp:${phone}:${code}`);
}

export async function saveOtp(
  phone: string,
  code: string,
  now: number = Date.now(),
): Promise<OtpRecord> {
  const record: OtpRecord = {
    phone,
    codeHash: await hashCode(phone, code),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: now,
  };
  if (fileBacked()) {
    const all = readAll();
    all[phone] = record;
    writeAll(all);
  } else {
    memory.set(phone, record);
  }
  return record;
}

export function getOtp(phone: string): OtpRecord | null {
  if (fileBacked()) return readAll()[phone] ?? null;
  return memory.get(phone) ?? null;
}

export function bumpOtpAttempts(phone: string): OtpRecord | null {
  const record = getOtp(phone);
  if (!record) return null;
  const next: OtpRecord = {
    ...record,
    attempts: Math.min(OTP_MAX_ATTEMPTS, record.attempts + 1),
  };
  if (fileBacked()) {
    const all = readAll();
    all[phone] = next;
    writeAll(all);
  } else {
    memory.set(phone, next);
  }
  return next;
}

export function deleteOtp(phone: string): void {
  if (fileBacked()) {
    const all = readAll();
    delete all[phone];
    writeAll(all);
  } else {
    memory.delete(phone);
  }
}

/** Seconds until a new code may be requested (0 = allowed now). */
export function resendWaitSeconds(phone: string, now: number = Date.now()): number {
  const record = getOtp(phone);
  if (!record) return 0;
  return otpResendWaitSeconds(record.lastSentAt, now);
}

export async function verifyOtpHash(
  phone: string,
  code: string,
  record: OtpRecord,
): Promise<boolean> {
  const hash = await hashCode(phone, code);
  if (hash.length !== record.codeHash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ record.codeHash.charCodeAt(i);
  return diff === 0;
}

export { OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_MS, OTP_TTL_MS };
