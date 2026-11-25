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
import {
  bumpOtpChallenge,
  clearOtpChallenge,
  otpChallengeMatches,
  readOtpChallenge,
} from '@/lib/auth/otp-cookie';
import { smsReadiness } from '@/lib/auth/sms';
import { instantOtpAllowedFor } from '@/lib/config/mode';
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

  // On a serverless host the issuing request and this one may run on different
  // instances, so the process-local record can be missing even though the code
  // was just issued. The signed challenge cookie (phone + code hash + expiry)
  // is the shared source of truth then, and it is issued for every code — SMS
  // included — not only the on-screen fallback.
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

  // The OTP is consumed only here, after the user row exists; a failed profile
  // step or DB write above leaves both the record and the cookie intact so the
  // same code can finish the signup.
  const customization = await profileCustomization(account.id);
  if (!customization) {
    // Only a business account keeps a business sub-type: `profile_mode` and
    // `business_type` must agree, and the DB checks reject anything outside
    // ('individual'|'business') and ('car-dealer'|'parts-store'|'workshop'|'rental').
    const businessAccount = account.accountType === 'showroom';
    const requestedBusiness =
      businessAccount &&
      typeof body.businessType === 'string' &&
      businessTypes.includes(body.businessType as never)
        ? (body.businessType as BusinessType)
        : null;
    await saveProfileCustomization(account.id, {
      profileMode: profileModeFor(account.accountType),
      businessType: requestedBusiness,
    });
  } else if (customization.profileMode === 'business' && account.accountType !== 'showroom') {
    // Hosted `users` rows carry no account type, so a returning business account
    // would otherwise be signed in as فردی and lose its storefront identity.
    account = { ...account, accountType: 'showroom' };
  }

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
