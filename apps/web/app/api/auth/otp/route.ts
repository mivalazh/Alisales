import { NextResponse } from 'next/server';
import { isValidMobile, normalizePhone } from '@alisales/schemas';
import { authSecret } from '@/lib/auth/session';
import { deleteOtp, generateOtp, resendWaitSeconds, saveOtp } from '@/lib/auth/otp-store';
import { sendOtpSms } from '@/lib/auth/sms';
import { demoAuthMode, demoOtpHintEnabled } from '@/lib/config/mode';
import { findUserByPhone } from '@/lib/data/s2-store';

/**
 * POST /api/auth/otp — { phone }
 *
 * 202 { ok: true, needsProfile } when a code was issued.
 * 400 invalid phone · 429 resend too soon · 502 provider failure · 503 product
 * not configured (hosted/strict deployment without SMS credentials, or missing
 * AUTH_SECRET).
 *
 * Without an SMS provider the code is NEVER in the body: in development — and
 * on a fixture/demo deployment (no Supabase credentials) — it is printed to
 * the server console only (C4). The single exception is the explicit public
 * `NEXT_PUBLIC_DEMO_OTP_HINT=true` preview switch, which adds `demoCode` so the
 * owner can sign in on a preview link; it is off by default and refused
 * whenever the deployment has hosted data or an SMS provider.
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
  const demo = demoAuthMode();
  if (!delivery.delivered) {
    if (delivery.reason === 'provider_error') {
      deleteOtp(phone);
      return NextResponse.json(
        { error: 'ارسال پیامک ناموفق بود؛ دوباره تلاش کنید.' },
        { status: 502 },
      );
    }
    if (!demo) {
      // Hosted deployment (or REQUIRE_HOSTED_SERVICES=true) with no provider:
      // refuse instead of issuing a code nobody can receive.
      deleteOtp(phone);
      return NextResponse.json(
        { error: 'ارسال پیامک در حال حاضر در دسترس نیست؛ بعداً تلاش کنید.' },
        { status: 503 },
      );
    }
    // Development / fixture-demo mode: the code is written to the server
    // console; the browser response only carries it behind the demo flag.
    console.info(`[alisales][otp] login code for ${phone}: ${code}`);
  }

  const body: { ok: true; needsProfile: boolean; demoCode?: string } = {
    ok: true,
    needsProfile: !existing,
  };
  if (!delivery.delivered && demoOtpHintEnabled()) body.demoCode = code;

  return NextResponse.json(body, { status: 202 });
}
