import { NextResponse } from 'next/server';
import {
  isOtpCode,
  isValidMobile,
  normalizePhone,
  otpStatus,
  otpStatusMessage,
  profileSchema,
} from '@alisales/schemas';
import { authSecret, createSessionToken, setSessionCookie } from '@/lib/auth/session';
import { bumpOtpAttempts, deleteOtp, getOtp, verifyOtpHash } from '@/lib/auth/otp-store';
import { createUser, findUserByPhone } from '@/lib/data/s2-store';

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
  if (!authSecret()) {
    return NextResponse.json(
      { error: 'ورود در حال حاضر در دسترس نیست؛ بعداً تلاش کنید.' },
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
  };

  const phoneRaw = typeof body.phone === 'string' ? body.phone : '';
  if (!isValidMobile(phoneRaw)) {
    return NextResponse.json({ error: 'شماره موبایل معتبر نیست.' }, { status: 400 });
  }
  const phone = normalizePhone(phoneRaw);

  const code = typeof body.code === 'string' ? body.code : '';
  if (!isOtpCode(code)) {
    return NextResponse.json({ error: 'کد تأیید باید شش رقم باشد.' }, { status: 400 });
  }

  const record = getOtp(phone);
  if (!record) {
    return NextResponse.json(
      { error: 'کد تأیید یافت نشد؛ دوباره درخواست کنید.' },
      { status: 400 },
    );
  }

  const status = otpStatus(record);
  if (status !== 'ok') {
    return NextResponse.json({ error: otpStatusMessage(status) }, { status: 401 });
  }

  const matched = await verifyOtpHash(phone, code, record);
  if (!matched) {
    bumpOtpAttempts(phone);
    return NextResponse.json(
      { error: otpStatusMessage('ok') },
      { status: 401 },
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

  deleteOtp(phone);

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
