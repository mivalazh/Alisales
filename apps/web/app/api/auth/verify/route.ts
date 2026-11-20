import { NextResponse } from 'next/server';
import {
  businessTypes,
  isOtpCode,
  isValidMobile,
  normalizePhone,
  otpStatus,
  otpStatusMessage,
  profileSchema,
  profileModeFor,
  type BusinessType,
} from '@alisales/schemas';
import {
  authSecret,
  createSessionToken,
  hasAuthSecretConfig,
  setSessionCookie,
} from '@/lib/auth/session';
import { bumpOtpAttempts, deleteOtp, getOtp, verifyOtpHash } from '@/lib/auth/otp-store';
import { clearDemoOtpCookie, demoOtpCookieMatches } from '@/lib/auth/otp-cookie';
import { smsReadiness } from '@/lib/auth/sms';
import { instantOtpAllowedFor, instantOtpFallbackAllowedFor } from '@/lib/config/mode';
import { createUser, findUserByPhone } from '@/lib/data/s2-store';
import { profileCustomization, saveProfileCustomization } from '@/lib/data/social-store';
import { dataUnavailableResponse } from '@/lib/http/data-unavailable';

/**
 * POST /api/auth/verify — { phone, code, displayName?, accountType? }
 *
 * A returning phone logs in with the code alone. A new phone must also send a
 * display name and an account type (فردی / نمایشگاه); without them the code is
 * NOT consumed, so the user can complete the form without requesting a new one.
 *
 * On success a signed httpOnly session cookie is set; the response never
 * contains the code, a hash or a token value.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    return await handlePost(request);
  } catch (error) {
    // A failed account/profile read must never be reported as a wrong code or
    // as a brand-new account.
    const unavailable = dataUnavailableResponse(error);
    if (unavailable) return unavailable;
    throw error;
  }
}

async function handlePost(request: Request): Promise<NextResponse> {
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

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }

  const body = raw as {
    phone?: unknown;
    code?: unknown;
    displayName?: unknown;
    accountType?: unknown;
    businessType?: unknown;
  };

  const phoneRaw = typeof body.phone === 'string' ? body.phone : '';
  if (!isValidMobile(phoneRaw)) {
    return NextResponse.json({ error: 'شماره موبایل معتبر نیست.' }, { status: 400 });
  }
  const phone = normalizePhone(phoneRaw);

  // Verify is gated too: a code or signed cookie from elsewhere must never
  // bypass the production allowlist for the instant OTP flow.
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

  const code = typeof body.code === 'string' ? body.code : '';
  if (!isOtpCode(code)) {
    return NextResponse.json({ error: 'کد تأیید باید شش رقم باشد.' }, { status: 400 });
  }

  const record = getOtp(phone);
  if (record) {
    const status = otpStatus(record);
    if (status !== 'ok') {
      return NextResponse.json({ error: otpStatusMessage(status) }, { status: 401 });
    }
    const matched = await verifyOtpHash(phone, code, record);
    if (!matched) {
      bumpOtpAttempts(phone);
      return NextResponse.json({ error: otpStatusMessage('ok') }, { status: 401 });
    }
  } else if (
    !(instantOtpFallbackAllowedFor(phone) && (await demoOtpCookieMatches(phone, code)))
  ) {
    // No in-memory record: either the code expired/was used, or another
    // serverless isolate issued it — the signed cookie covers the allowlisted
    // instant fallback so a launch login never dead-ends.
    return NextResponse.json(
      { error: 'کد تأیید یافت نشد؛ دوباره درخواست کنید.' },
      { status: 400 },
    );
  }

  const existing = await findUserByPhone(phone);
  let account = existing;

  if (!account) {
    const parsed = profileSchema.safeParse({
      displayName: body.displayName,
      accountType: body.accountType,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'نام نمایشی و نوع حساب (فردی یا نمایشگاه) را کامل کنید.' },
        { status: 400 },
      );
    }
    account = await createUser({
      phone,
      displayName: parsed.data.displayName,
      accountType: parsed.data.accountType,
    });
  }

  if (!(await profileCustomization(account.id))) {
    const requestedBusiness =
      typeof body.businessType === 'string' &&
      businessTypes.includes(body.businessType as never)
        ? (body.businessType as BusinessType)
        : null;
    await saveProfileCustomization(account.id, {
      profileMode: profileModeFor(account.accountType),
      businessType: requestedBusiness,
    });
  }

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
