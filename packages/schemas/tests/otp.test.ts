import { describe, expect, it } from 'vitest';
import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  isOtpCode,
  otpEquals,
  otpResendWaitSeconds,
  otpStatus,
  otpStatusMessage,
} from '../src/otp';

describe('OTP policy constants', () => {
  it('uses six digits, a two-minute lifetime and five attempts', () => {
    expect(OTP_TTL_MS).toBe(120_000);
    expect(OTP_MAX_ATTEMPTS).toBe(5);
    expect(OTP_RESEND_COOLDOWN_MS).toBe(60_000);
  });
});

describe('isOtpCode', () => {
  it('accepts exactly six digits, Latin or Persian', () => {
    expect(isOtpCode('123456')).toBe(true);
    expect(isOtpCode('۱۲۳۴۵۶')).toBe(true);
    expect(isOtpCode(' 123456 ')).toBe(true);
  });

  it('rejects wrong lengths, letters and empty input', () => {
    expect(isOtpCode('12345')).toBe(false);
    expect(isOtpCode('1234567')).toBe(false);
    expect(isOtpCode('12345a')).toBe(false);
    expect(isOtpCode('')).toBe(false);
  });
});

describe('otpStatus', () => {
  const now = 1_000_000;

  it('is ok before expiry with attempts left', () => {
    expect(otpStatus({ expiresAt: now + 1, attempts: 0 }, now)).toBe('ok');
  });

  it('is expired after the deadline', () => {
    expect(otpStatus({ expiresAt: now - 1, attempts: 1 }, now)).toBe('expired');
  });

  it('locks after the fifth wrong attempt, even past expiry', () => {
    expect(otpStatus({ expiresAt: now + 10_000, attempts: 5 }, now)).toBe('locked');
    expect(otpStatus({ expiresAt: now - 10_000, attempts: 5 }, now)).toBe('locked');
  });
});

describe('otpEquals', () => {
  it('matches identical codes', () => {
    expect(otpEquals('123456', '123456')).toBe(true);
    expect(otpEquals('۱۲۳۴۵۶', '123456')).toBe(true);
  });

  it('rejects a different digit at any position', () => {
    expect(otpEquals('123457', '123456')).toBe(false);
    expect(otpEquals('023456', '123456')).toBe(false);
  });

  it('rejects different lengths without throwing', () => {
    expect(otpEquals('1234567', '123456')).toBe(false);
    expect(otpEquals('', '123456')).toBe(false);
  });
});

describe('otp messaging and resend cooldown', () => {
  it('returns a distinct Persian message per status', () => {
    const messages = new Set([
      otpStatusMessage('ok'),
      otpStatusMessage('expired'),
      otpStatusMessage('locked'),
    ]);
    expect(messages.size).toBe(3);
  });

  it('counts down the resend cooldown', () => {
    const now = 1_000_000;
    expect(otpResendWaitSeconds(now - 30_000, now)).toBe(30);
    expect(otpResendWaitSeconds(now, now)).toBe(60);
    expect(otpResendWaitSeconds(now - OTP_RESEND_COOLDOWN_MS, now)).toBe(0);
    expect(otpResendWaitSeconds(now - 90_000, now)).toBe(0);
  });
});
