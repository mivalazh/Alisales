/**
 * SMS delivery adapter (S2 / C4).
 *
 * The product only needs one operation — send a six-digit login code.
 *
 * SMS.ir Fast Verification is preferred when configured:
 *   SMS_IR_API_KEY      SMS.ir panel API key
 *   SMS_IR_TEMPLATE_ID  approved Fast Verification template (required)
 *
 * The generic adapter remains available for Kavenegar-style gateways:
 *   SMS_API_KEY   provider token
 *   SMS_SENDER    approved sender line
 *   SMS_API_URL   provider endpoint (POST JSON { to, from, text })
 *
 * A bare SMS_API_KEY with no generic SMS_API_URL/SMS_SENDER is treated as an
 * SMS.ir key, so an existing single-key deployment keeps working. A template id
 * is still required: the old implicit 100000 fallback is not a real template
 * and produced confusing provider failures.
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

export type SmsProvider = 'sms_ir' | 'generic';

export interface SmsReadiness {
  configured: boolean;
  provider: SmsProvider | null;
  /** Environment variable names that still need a value. Never values. */
  missing: string[];
  templateId: number | null;
  templateIdConfigured: boolean;
}

const SMS_IR_ENDPOINT = 'https://api.sms.ir/v1/send/verify';

function configuredTemplateId(): number | null {
  const raw = process.env.SMS_IR_TEMPLATE_ID?.trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function smsIrKey(): string {
  const explicit = process.env.SMS_IR_API_KEY?.trim();
  if (explicit) return explicit;

  const legacy = process.env.SMS_API_KEY?.trim();
  if (!legacy) return '';
  // A bare key, or a key paired with only a template id, is an SMS.ir key.
  if (process.env.SMS_IR_TEMPLATE_ID) return legacy;
  if (!process.env.SMS_API_URL && !process.env.SMS_SENDER) return legacy;
  return '';
}

/**
 * Non-secret description of the SMS configuration. Used by `/api/health` and
 * by the OTP route to return a specific error such as
 * `SMS_IR_TEMPLATE_ID_MISSING` instead of a generic "login unavailable".
 */
export function smsReadiness(): SmsReadiness {
  const explicitIrKey = process.env.SMS_IR_API_KEY?.trim() ?? '';
  const legacyKey = process.env.SMS_API_KEY?.trim() ?? '';
  const genericUrl = process.env.SMS_API_URL?.trim() ?? '';
  const genericSender = process.env.SMS_SENDER?.trim() ?? '';
  const templateId = configuredTemplateId();

  const usingSmsIr = Boolean(explicitIrKey) || (Boolean(legacyKey) && !genericUrl && !genericSender);
  if (usingSmsIr) {
    return templateId
      ? {
          configured: true,
          provider: 'sms_ir',
          missing: [],
          templateId,
          templateIdConfigured: true,
        }
      : {
          configured: false,
          provider: 'sms_ir',
          missing: ['SMS_IR_TEMPLATE_ID'],
          templateId: null,
          templateIdConfigured: false,
        };
  }

  const missing: string[] = [];
  if (!legacyKey) missing.push('SMS_API_KEY');
  if (!genericSender) missing.push('SMS_SENDER');
  if (!genericUrl) missing.push('SMS_API_URL');
  if (missing.length > 0) {
    return {
      configured: false,
      provider: legacyKey || genericUrl || genericSender ? 'generic' : null,
      missing,
      templateId: null,
      templateIdConfigured: false,
    };
  }

  return {
    configured: true,
    provider: 'generic',
    missing: [],
    templateId: null,
    templateIdConfigured: false,
  };
}

export function smsConfigured(): boolean {
  return smsReadiness().configured;
}

function isSandboxOrUnverified(message: string): boolean {
  return /sandbox|unverified|not\s+verified|whitelist|white\s*list|verify\s+your\s+account|لیست سفید|تایید\s*نشده|تأیید\s*نشده|حساب.*(?:تایید|تأیید)|(?:تایید|تأیید).*حساب/i.test(
    message,
  );
}

async function sendSmsIr(phone: string, code: string): Promise<SmsDelivery> {
  const apiKey = smsIrKey();
  const templateId = configuredTemplateId();
  if (!apiKey || !templateId) return { delivered: false, reason: 'not_configured' };

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
        templateId,
        // The template placeholder is `#CODE#`, so `CODE` is the name that
        // matters; the lower-case twin stays for templates authored as
        // `#code#`, which SMS.ir matches case-sensitively.
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
  const readiness = smsReadiness();
  if (!readiness.configured) return { delivered: false, reason: 'not_configured' };
  if (readiness.provider === 'sms_ir') return sendSmsIr(phone, code);
  return sendGeneric(phone, code);
}
