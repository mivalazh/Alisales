import { NextResponse } from 'next/server';
import {
  isOtpCode,
  isValidMobile,
  normalizePhone,
  otpStatus,
  otpStatusMessage,
} from '@alisales/schemas';
import { authSecret, createSessionToken, setSessionCookie } from '@/lib/auth/session';
import { bumpOtpAttempts, deleteOtp, getOtp, verifyOtpHash } from '@/lib/auth/otp-store';
import { clearDemoOtpCookie, demoOtpCookieMatches } from '@/lib/auth/otp-cookie';
import { clearPasswordFailures, passwordProblem, saveAccountPassword } from '@/lib/auth/password';
import { smsConfigured } from '@/lib/auth/sms';
import { demoAuthMode, instantOtpAllowedFor } from '@/lib/config/mode';
import { findUserByPhone } from '@/lib/data/s2-store';
import { rateLimit } from '@/lib/security/rate-limit';

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
    return NextResponse.json(
      { error: 'بازیابی رمز عبور در حال حاضر در دسترس نیست؛ بعداً تلاش کنید.' },
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
  if (!smsConfigured() && !instantOtpAllowedFor(phone)) {
    return NextResponse.json(
      { error: 'بازیابی رمز برای این شماره فعال نیست؛ با پشتیبانی تماس بگیرید.' },
      { status: 403 },
    );
  }

  const record = getOtp(phone);
  if (record) {
    const status = otpStatus(record);
    if (status !== 'ok') {
      return NextResponse.json({ error: otpStatusMessage(status) }, { status: 401 });
    }
    if (!(await verifyOtpHash(phone, code, record))) {
      bumpOtpAttempts(phone);
      return NextResponse.json({ error: otpStatusMessage('ok') }, { status: 401 });
    }
  } else if (!(demoAuthMode() && (await demoOtpCookieMatches(phone, code)))) {
    return NextResponse.json(
      { error: 'کد تأیید یافت نشد؛ دوباره درخواست کنید.' },
      { status: 400 },
    );
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
  await clearDemoOtpCookie();

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
