import {
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  otpResendWaitSeconds,
} from '@alisales/schemas';
import { authSecret, hmacSha256 } from './session';
import { readJson, writeJson } from '../storage/demo-store';

/**
 * OTP storage (S2 / C4).
 *
 * Codes are stored ONLY as an HMAC-SHA256 hash, never in clear text. A record
 * carries its expiry, attempt count and last send time. Records go through the
 * demo store, which is a JSON file on Node — Next keeps a separate module graph
 * per route, so in-process memory would not be shared between the request and
 * verify handlers — and isolate memory on a runtime without a filesystem
 * (Workers preview). A hosted production deployment with a real SMS provider
 * still keeps them that way, since the code leaves the server immediately.
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

const FILE = 'otp.json';

function readAll(): Record<string, OtpRecord> {
  return readJson<Record<string, OtpRecord>>(FILE, () => ({}));
}

function writeAll(all: Record<string, OtpRecord>): void {
  writeJson(FILE, all);
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
  const all = readAll();
  all[phone] = record;
  writeAll(all);
  return record;
}

export function getOtp(phone: string): OtpRecord | null {
  return readAll()[phone] ?? null;
}

export function bumpOtpAttempts(phone: string): OtpRecord | null {
  const record = getOtp(phone);
  if (!record) return null;
  const next: OtpRecord = {
    ...record,
    attempts: Math.min(OTP_MAX_ATTEMPTS, record.attempts + 1),
  };
  const all = readAll();
  all[phone] = next;
  writeAll(all);
  return next;
}

export function deleteOtp(phone: string): void {
  const all = readAll();
  delete all[phone];
  writeAll(all);
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
