import { NextResponse } from 'next/server';
import {
  isOtpCode,
  isValidMobile,
  normalizePhone,
  otpStatus,
  otpStatusMessage,
} from '@alisales/schemas';
import {
  authSecret,
  createSessionToken,
  hasAuthSecretConfig,
  setSessionCookie,
} from '@/lib/auth/session';
import { bumpOtpAttempts, deleteOtp, getOtp, verifyOtpHash } from '@/lib/auth/otp-store';
import {
  bumpOtpChallenge,
  clearOtpChallenge,
  otpChallengeMatches,
  readOtpChallenge,
} from '@/lib/auth/otp-cookie';
import { clearPasswordFailures, passwordProblem, saveAccountPassword } from '@/lib/auth/password';
import { smsReadiness } from '@/lib/auth/sms';
import { instantOtpAllowedFor } from '@/lib/config/mode';
import { findUserByPhone } from '@/lib/data/s2-store';
import { rateLimit } from '@/lib/security/rate-limit';
import { dataUnavailableResponse } from '@/lib/http/data-unavailable';

/**
 * POST /api/auth/password/reset — { phone, code, password }
 *
 * The «رمز عبور را فراموش کرده‌ام» path: prove the phone with a fresh OTP,
 * replace the password and open the session in one step. No current password
 * is required because the SMS code is the ownership proof. An unknown phone
 * gets the same generic answer as a wrong code, so the endpoint does not
 * become an account enumeration oracle.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    return await handlePost(request);
  } catch (error) {
    const unavailable = dataUnavailableResponse(error);
    if (unavailable) return unavailable;
    throw error;
  }
}

async function handlePost(request: Request): Promise<NextResponse> {
  const limited = rateLimit({
    request,
    bucket: 'auth-password-reset',
    limit: 5,
    windowMs: 10 * 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'تلاش‌های بازیابی زیاد بود؛ چند دقیقه بعد دوباره امتحان کنید.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
    );
  }

  if (!authSecret()) {
    const missing = !hasAuthSecretConfig();
    return NextResponse.json(
      {
        code: missing ? 'AUTH_SECRET_MISSING' : 'AUTH_SECRET_TOO_SHORT',
        error: missing
          ? 'پیکربندی ورود ناقص است: AUTH_SECRET یا SESSION_SECRET تنظیم نشده است.'
          : 'پیکربندی ورود ناقص است: AUTH_SECRET یا SESSION_SECRET باید حداقل ۱۶ کاراکتر باشد.',
      },
      { status: 503 },
    );
  }

  let body: { phone?: unknown; code?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { phone?: unknown; code?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }

  const phoneRaw = typeof body.phone === 'string' ? body.phone : '';
  const code = typeof body.code === 'string' ? body.code : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!isValidMobile(phoneRaw)) {
    return NextResponse.json({ error: 'شماره موبایل معتبر نیست.' }, { status: 400 });
  }
  if (!isOtpCode(code)) {
    return NextResponse.json({ error: 'کد تأیید باید شش رقم باشد.' }, { status: 400 });
  }
  const problem = passwordProblem(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const phone = normalizePhone(phoneRaw);
  const sms = smsReadiness();
  if (
    !sms.configured &&
    sms.provider === 'sms_ir' &&
    sms.missing.includes('SMS_IR_TEMPLATE_ID') &&
    !instantOtpAllowedFor(phone)
  ) {
    return NextResponse.json(
      {
        code: 'SMS_IR_TEMPLATE_ID_MISSING',
        error:
          'پیکربندی SMS.ir ناقص است: SMS_IR_TEMPLATE_ID تنظیم نشده یا معتبر نیست.',
      },
      { status: 503 },
    );
  }
  if (!sms.configured && !instantOtpAllowedFor(phone)) {
    return NextResponse.json(
      {
        code: 'INSTANT_OTP_NOT_ALLOWED',
        error:
          'پیامک پیکربندی نشده و این شماره در INSTANT_OTP_ALLOWLIST نیست؛ با پشتیبانی تماس بگیرید.',
      },
      { status: 403 },
    );
  }

  // The store may be empty on another serverless instance; the signed cookie
  // challenge carries the same hash, so a reset never dead-ends there.
  const record = getOtp(phone);
  const challenge = record ? null : await readOtpChallenge(phone);
  const stored = record ?? challenge;
  if (!stored) {
    return NextResponse.json(
      { error: 'کد تأیید یافت نشد؛ دوباره درخواست کنید.' },
      { status: 400 },
    );
  }
  const status = otpStatus(stored);
  if (status !== 'ok') {
    return NextResponse.json({ error: otpStatusMessage(status) }, { status: 401 });
  }
  const matched = record
    ? await verifyOtpHash(phone, code, record)
    : await otpChallengeMatches(phone, code);
  if (!matched) {
    if (record) bumpOtpAttempts(phone);
    else if (challenge) await bumpOtpChallenge(challenge);
    return NextResponse.json({ error: otpStatusMessage('ok') }, { status: 401 });
  }

  const account = await findUserByPhone(phone);
  if (!account) {
    return NextResponse.json(
      { error: 'شماره یا کد تأیید درست نیست.' },
      { status: 401 },
    );
  }

  const saved = await saveAccountPassword(account.id, account.phone, password);
  if (!saved) {
    return NextResponse.json(
      { error: 'ذخیره رمز عبور انجام نشد؛ دوباره تلاش کنید.' },
      { status: 500 },
    );
  }

  clearPasswordFailures(phone);
  deleteOtp(phone);
  await clearOtpChallenge();

  const token = await createSessionToken({
    sub: account.id,
    phone: account.phone,
    displayName: account.displayName,
    accountType: account.accountType,
  });
  await setSessionCookie(token);

  return NextResponse.json({
    ok: true,
    user: {
      id: account.id,
      displayName: account.displayName,
      accountType: account.accountType,
    },
  });
}
