import { NextResponse } from 'next/server';
import { isValidMobile, normalizePhone, otpRequestSchema } from '@alisales/schemas';
import { authSecret, hasAuthSecretConfig } from '@/lib/auth/session';
import { deleteOtp, generateOtp, resendWaitSeconds, saveOtp } from '@/lib/auth/otp-store';
import { setDemoOtpCookie } from '@/lib/auth/otp-cookie';
import { sendOtpSms, smsReadiness } from '@/lib/auth/sms';
import {
  demoAuthMode,
  instantOtpAllowedFor,
  instantOtpEmergencyAllowedFor,
  instantOtpFallbackAllowedFor,
} from '@/lib/config/mode';
import { findUserByPhone } from '@/lib/data/s2-store';
import { rateLimit } from '@/lib/security/rate-limit';
import { dataUnavailableResponse } from '@/lib/http/data-unavailable';

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
  try {
    return await handlePost(request);
  } catch (error) {
    // A failed account lookup is not "no account exists"; say so instead.
    const unavailable = dataUnavailableResponse(error);
    if (unavailable) return unavailable;
    throw error;
  }
}

async function handlePost(request: Request): Promise<NextResponse> {
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

  const parsed = otpRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'شماره موبایل معتبر نیست.' }, { status: 400 });
  }
  if (!isValidMobile(parsed.data.phone)) {
    return NextResponse.json({ error: 'شماره موبایل معتبر نیست.' }, { status: 400 });
  }
  const phone = normalizePhone(parsed.data.phone);

  // Refuse before issuing or storing anything: without a usable SMS provider,
  // production may only use instant OTP for the operator's launch accounts.
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
  // No provider configured: the instant/demo path. The gates above already
  // restrict that path to the allowlist in production, so `demo` only widens
  // who sees the code in a development build.
  const demo = demoAuthMode();
  // SMS.ir can reject an unverified/sandbox account before delivery, reject a
  // template, or time out. Do not lock launch users out: an allowlisted launch
  // number gets the code on screen instead, and the six boxes open on a 200.
  //
  // Bounded on purpose: `instantOtpEmergencyAllowedFor` is exact allowlist
  // membership, and `instantOtpFallbackAllowedFor` is the separate opt-in
  // switch for anything else. An arbitrary phone still never receives a code it
  // did not prove control of by SMS. See LOGIN_RUNBOOK.md.
  const fallbackAllowed =
    instantOtpEmergencyAllowedFor(phone) || instantOtpFallbackAllowedFor(phone);
  // The only paths that reach here without delivery are demo mode and an
  // allowed fallback (everything else returned above).
  const showCode = !delivery.delivered && (demo || fallbackAllowed);

  if (!delivery.delivered && !showCode) {
    deleteOtp(phone);
    if (delivery.reason === 'provider_error') {
      return NextResponse.json(
        {
          code: 'SMS_PROVIDER_ERROR',
          error:
            'ارسال پیامک ناموفق بود (خطای سرویس‌دهنده)؛ تنظیمات SMS_API_URL و کلید را بررسی کنید.',
        },
        { status: 502 },
      );
    }
    if (delivery.reason === 'sandbox') {
      return NextResponse.json(
        {
          code: 'SMS_IR_TEMPLATE_NOT_APPROVED',
          error:
            'حساب یا قالب SMS.ir تأیید نشده است؛ قالب Fast Verification را تأیید کنید یا شماره را به INSTANT_OTP_ALLOWLIST اضافه کنید.',
        },
        { status: 503 },
      );
    }
    // Hosted deployment with no provider: refuse instead of issuing a code
    // nobody can receive.
    return NextResponse.json(
      {
        code: 'SMS_NOT_CONFIGURED',
        error:
          'سرویس پیامک پیکربندی نشده است؛ SMS_IR_API_KEY و SMS_IR_TEMPLATE_ID یا هر سه متغیر SMS_API_KEY/SMS_SENDER/SMS_API_URL را تنظیم کنید.',
      },
      { status: 503 },
    );
  }

  if (showCode) {
    // Development / demo / launch-number fallback: the code is written to the
    // server console and handed to this browser.
    console.info(`[alisales][otp] login code for ${phone}: ${code}`);
  }

  const body: {
    ok: true;
    needsProfile: boolean;
    delivery: 'sms' | 'instant';
    warning?: string;
    devCode?: string;
    demoCode?: string;
    fallbackCode?: string;
  } = {
    ok: true,
    needsProfile: !existing,
    delivery: delivery.delivered ? 'sms' : 'instant',
  };
  if (showCode) {
    body.devCode = code;
    body.demoCode = code;
    // The launch-flow name: the client opens the six boxes on this value.
    body.fallbackCode = code;
    // Name the actual failure: a missing provider is not a gateway error.
    body.warning =
      delivery.reason === 'sandbox'
        ? 'SMS_IR_TEMPLATE_NOT_APPROVED'
        : delivery.reason === 'provider_error'
          ? 'SMS_PROVIDER_ERROR_FALLBACK'
          : sms.missing.length > 0
            ? 'SMS_NOT_CONFIGURED'
            : 'INSTANT_OTP_FALLBACK';
    // Hand the code to this browser too, so verify still works when a different
    // isolate (no shared memory) serves the next request.
    await setDemoOtpCookie(phone, code);
  }

  // 200 when the code is shown on screen (the boxes open on it); 202 keeps the
  // "code sent" semantics for a delivered SMS.
  return NextResponse.json(body, { status: showCode ? 200 : 202 });
}
