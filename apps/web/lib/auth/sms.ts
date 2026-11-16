/**
 * SMS delivery adapter (S2 / C4).
 *
 * The product only needs one operation — send a six-digit login code.
 *
 * SMS.ir Fast Verification is preferred when configured:
 *   SMS_IR_API_KEY      SMS.ir panel API key
 *   SMS_IR_TEMPLATE_ID  approved Fast Verification template (default 100000)
 *
 * The generic adapter remains available for Kavenegar and similar providers:
 *   SMS_API_KEY   provider token
 *   SMS_SENDER    approved sender line
 *   SMS_API_URL   provider endpoint (POST JSON { to, code })
 *
 * A bare SMS_API_KEY with no generic SMS_API_URL/SMS_SENDER is treated as an
 * SMS.ir key, so an existing single-key deployment keeps working.
 *
 * With no credentials the caller decides what happens: in development the
 * route logs the code server-side; production uses the allowlisted instant OTP
 * fallback. This module never logs the code itself and never returns it.
 */

export interface SmsDelivery {
  delivered: boolean;
  /**
   * Present only when delivery failed; safe for server logs.
   * `sandbox` means SMS.ir rejected the account/template before delivery
   * (unverified account, sandbox mode, whitelist-only).
   */
  reason?: 'not_configured' | 'provider_error' | 'sandbox';
}

const SMS_IR_ENDPOINT = 'https://api.sms.ir/v1/send/verify';

function smsIrApiKey(): string {
  const explicit = process.env.SMS_IR_API_KEY?.trim();
  if (explicit) return explicit;

  const legacy = process.env.SMS_API_KEY?.trim();
  if (!legacy) return '';
  // An explicit template id opts a legacy key into SMS.ir; otherwise a bare key
  // with no generic endpoint is also treated as SMS.ir.
  if (process.env.SMS_IR_TEMPLATE_ID) return legacy;
  if (!process.env.SMS_API_URL && !process.env.SMS_SENDER) return legacy;
  return '';
}

export function smsConfigured(): boolean {
  return Boolean(
    smsIrApiKey() ||
      (process.env.SMS_API_KEY && process.env.SMS_SENDER && process.env.SMS_API_URL),
  );
}

function smsIrTemplateId(): number {
  const parsed = Number(process.env.SMS_IR_TEMPLATE_ID ?? '100000');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100000;
}

function isSandboxOrUnverified(message: string): boolean {
  return /sandbox|unverified|not\s+verified|whitelist|white\s*list|verify\s+your\s+account|لیست سفید|تایید\s*نشده|تأیید\s*نشده|حساب.*(?:تایید|تأیید)|(?:تایید|تأیید).*حساب/i.test(
    message,
  );
}

async function sendSmsIr(phone: string, code: string): Promise<SmsDelivery> {
  const apiKey = smsIrApiKey();
  if (!apiKey) return { delivered: false, reason: 'not_configured' };

  try {
    const response = await fetch(SMS_IR_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/plain',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        mobile: phone,
        templateId: smsIrTemplateId(),
        parameters: [
          { name: 'CODE', value: code },
          { name: 'code', value: code },
        ],
      }),
    });

    const raw = await response.text().catch(() => '');
    interface SmsIrResponse {
      status?: number | string;
      message?: string;
      data?: { messageId?: number | string } | null;
    }
    let payload: SmsIrResponse | null = null;
    try {
      payload = raw ? (JSON.parse(raw) as SmsIrResponse) : null;
    } catch {
      // SMS.ir usually replies JSON; plain text is handled below.
    }

    const delivered =
      response.ok &&
      (Number(payload?.status) === 1 || payload?.data?.messageId !== undefined);
    if (delivered) return { delivered: true };

    const detail = `${payload?.message ?? ''} ${raw}`.trim();
    if (isSandboxOrUnverified(detail)) return { delivered: false, reason: 'sandbox' };
    return { delivered: false, reason: 'provider_error' };
  } catch {
    return { delivered: false, reason: 'provider_error' };
  }
}

async function sendGeneric(phone: string, code: string): Promise<SmsDelivery> {
  try {
    const response = await fetch(process.env.SMS_API_URL!, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.SMS_API_KEY!}`,
      },
      body: JSON.stringify({
        to: phone,
        from: process.env.SMS_SENDER,
        text: `کد ورود Alisales: ${code}`,
      }),
    });
    if (!response.ok) return { delivered: false, reason: 'provider_error' };
    return { delivered: true };
  } catch {
    return { delivered: false, reason: 'provider_error' };
  }
}

export async function sendOtpSms(phone: string, code: string): Promise<SmsDelivery> {
  if (smsIrApiKey()) return sendSmsIr(phone, code);
  if (process.env.SMS_API_KEY && process.env.SMS_SENDER && process.env.SMS_API_URL) {
    return sendGeneric(phone, code);
  }
  return { delivered: false, reason: 'not_configured' };
}
