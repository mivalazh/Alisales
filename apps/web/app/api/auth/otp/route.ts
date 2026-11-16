import { NextResponse } from 'next/server';
import { isValidMobile, normalizePhone, otpRequestSchema } from '@alisales/schemas';
import { authSecret } from '@/lib/auth/session';
import { deleteOtp, generateOtp, resendWaitSeconds, saveOtp } from '@/lib/auth/otp-store';
import { setDemoOtpCookie } from '@/lib/auth/otp-cookie';
import { sendOtpSms, smsConfigured } from '@/lib/auth/sms';
import {
  demoAuthMode,
  demoOtpHintEnabled,
  instantOtpAllowedFor,
  instantOtpFallbackAllowedFor,
} from '@/lib/config/mode';
import { findUserByPhone } from '@/lib/data/s2-store';
import { rateLimit } from '@/lib/security/rate-limit';

/**
 * POST /api/auth/otp — { phone }
 *
 * 202 { ok: true, needsProfile } when a code was issued.
 * 400 invalid phone · 429 resend too soon · 502 provider failure · 503 product
 * not configured (hosted/strict deployment without SMS credentials, or missing
 * AUTH_SECRET).
 *
 * Without an SMS provider the six-digit code is returned as `devCode` (and the
 * legacy `demoCode` alias), stored in a signed HTTP-only cookie, and printed to
 * the server log. Development allows every number; production allows only the
 * exact `INSTANT_OTP_ALLOWLIST`, so this path cannot create accounts for
 * arbitrary phones. With an SMS provider configured no code is returned.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const limited = rateLimit({
    request,
    bucket: 'auth-otp',
    limit: 5,
    windowMs: 10 * 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'درخواست‌های ورود بیش از حد مجاز است؛ چند دقیقه بعد تلاش کنید.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
    );
  }

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

  const parsed = otpRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'شماره موبایل معتبر نیست.' }, { status: 400 });
  }
  if (!isValidMobile(parsed.data.phone)) {
    return NextResponse.json({ error: 'شماره موبایل معتبر نیست.' }, { status: 400 });
  }
  const phone = normalizePhone(parsed.data.phone);

  // Refuse before issuing or storing anything: without SMS, production may only
  // use instant OTP for the operator's launch accounts.
  if (!smsConfigured() && !instantOtpAllowedFor(phone)) {
    return NextResponse.json(
      { error: 'ورود آزمایشی برای این شماره فعال نیست؛ با پشتیبانی تماس بگیرید.' },
      { status: 403 },
    );
  }

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
  // SMS.ir can reject an unverified/sandbox account before delivery. Do not
  // lock launch users out: fall back to the allowlisted instant code.
  const sandboxFallback =
    !delivery.delivered &&
    delivery.reason === 'sandbox' &&
    instantOtpFallbackAllowedFor(phone);

  if (!delivery.delivered) {
    if (delivery.reason === 'provider_error' || (delivery.reason === 'sandbox' && !sandboxFallback)) {
      deleteOtp(phone);
      return NextResponse.json(
        { error: 'ارسال پیامک ناموفق بود؛ دوباره تلاش کنید.' },
        { status: 502 },
      );
    }
    if (!demo && !sandboxFallback) {
      // Hosted deployment with no provider: refuse instead of issuing a code
      // nobody can receive.
      deleteOtp(phone);
      return NextResponse.json(
        { error: 'ارسال پیامک در حال حاضر در دسترس نیست؛ بعداً تلاش کنید.' },
        { status: 503 },
      );
    }
    // Development / demo / SMS.ir sandbox fallback: the code is written to the
    // server console and handed to this browser.
    console.info(`[alisales][otp] login code for ${phone}: ${code}`);
  }

  const body: { ok: true; needsProfile: boolean; devCode?: string; demoCode?: string } = {
    ok: true,
    needsProfile: !existing,
  };
  if (!delivery.delivered && (demoOtpHintEnabled(phone) || sandboxFallback)) {
    body.devCode = code;
    body.demoCode = code;
  }

  // Hand the code to this browser too, so verify still works when a different
  // isolate (no shared memory) serves the next request.
  if (demo || sandboxFallback) await setDemoOtpCookie(phone, code);

  return NextResponse.json(body, { status: 202 });
}
