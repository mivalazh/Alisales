import { NextResponse } from 'next/server';
import { isValidMobile, normalizePhone } from '@alisales/schemas';
import { authSecret } from '@/lib/auth/session';
import { deleteOtp, generateOtp, resendWaitSeconds, saveOtp } from '@/lib/auth/otp-store';
import { sendOtpSms } from '@/lib/auth/sms';
import { findUserByPhone } from '@/lib/data/s2-store';

/**
 * POST /api/auth/otp — { phone }
 *
 * 202 { ok: true, needsProfile } when a code was issued.
 * 400 invalid phone · 429 resend too soon · 502 provider failure · 503 product
 * not configured (production without SMS credentials, or missing AUTH_SECRET).
 *
 * The code itself is NEVER in the body. In development without an SMS provider
 * it is printed to the server console only (C4).
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

  const phoneRaw = typeof (raw as { phone?: unknown })?.phone === 'string'
    ? (raw as { phone: string }).phone
    : '';
  if (!isValidMobile(phoneRaw)) {
    return NextResponse.json({ error: 'شماره موبایل معتبر نیست.' }, { status: 400 });
  }
  const phone = normalizePhone(phoneRaw);

  const wait = resendWaitSeconds(phone);
  if (wait > 0) {
    return NextResponse.json(
      { error: `برای ارسال دوباره کد ${wait} ثانیه صبر کنید.` },
      { status: 429 },
    );
  }

  const existing = await findUserByPhone(phone);
  const code = generateOtp();
  await saveOtp(phone, code);

  const delivery = await sendOtpSms(phone, code);
  if (!delivery.delivered) {
    if (delivery.reason === 'provider_error') {
      deleteOtp(phone);
      return NextResponse.json(
        { error: 'ارسال پیامک ناموفق بود؛ دوباره تلاش کنید.' },
        { status: 502 },
      );
    }
    if (process.env.NODE_ENV === 'production') {
      deleteOtp(phone);
      return NextResponse.json(
        { error: 'ارسال پیامک در حال حاضر در دسترس نیست؛ بعداً تلاش کنید.' },
        { status: 503 },
      );
    }
    // Development only: the code is written to the server console, never to
    // the HTTP response and never to the browser bundle.
    console.info(`[alisales][otp] login code for ${phone}: ${code}`);
  }

  return NextResponse.json({ ok: true, needsProfile: !existing }, { status: 202 });
}
