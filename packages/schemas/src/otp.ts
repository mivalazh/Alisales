import { toLatinDigits } from './digits';

/**
 * One-time login codes (S2 / C4).
 *
 * Pure policy only — generation and storage live in the web app so this
 * module stays usable in the browser bundle without any crypto import.
 *
 * Security decisions encoded here:
 *  - Exactly six ASCII digits, nothing else (no letters, no whitespace).
 *  - Two-minute lifetime; a fifth wrong guess locks the code.
 *  - Comparison is timing-safe: never short-circuit on the first mismatch.
 *  - The code is NEVER part of an API response in any environment.
 */

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 2 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export type OtpStatus = 'ok' | 'expired' | 'locked';

/** Six digits typed by the user (Persian digits tolerated) — nothing else. */
export function isOtpCode(input: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(toLatinDigits(input).trim());
}

/** Usability of a stored OTP record at `now`. Locked wins over expired. */
export function otpStatus(
  record: { expiresAt: number; attempts: number },
  now: number = Date.now(),
): OtpStatus {
  if (record.attempts >= OTP_MAX_ATTEMPTS) return 'locked';
  if (now > record.expiresAt) return 'expired';
  return 'ok';
}

/** Timing-safe equality for two equal-length numeric codes. */
export function otpEquals(input: string, expected: string): boolean {
  const a = toLatinDigits(input).trim();
  const b = expected.trim();
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Persian message for a rejected code attempt (status only, no secrets). */
export function otpStatusMessage(status: OtpStatus): string {
  if (status === 'expired') return 'کد تأیید منقضی شده است؛ دوباره درخواست کنید.';
  if (status === 'locked') return 'تعداد تلاش‌ها زیاد شد؛ کد تازه درخواست کنید.';
  return 'کد تأیید نادرست است.';
}

/** Seconds a client should wait before requesting another code. */
export function otpResendWaitSeconds(
  lastSentAt: number,
  now: number = Date.now(),
): number {
  const elapsed = now - lastSentAt;
  if (elapsed >= OTP_RESEND_COOLDOWN_MS) return 0;
  return Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
}
