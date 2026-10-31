/**
 * SMS delivery adapter (S2 / C4).
 *
 * The product only needs one operation — send a six-digit login code. The
 * adapter reads generic credentials so any Iranian provider can be wired in
 * without touching the auth flow:
 *
 *   SMS_API_KEY   provider token
 *   SMS_SENDER    approved sender line
 *   SMS_API_URL   provider endpoint (POST JSON { to, code })
 *
 * With no credentials the caller decides what happens: in development the
 * route logs the code server-side, in production it answers 503. This module
 * never logs the code itself and never returns it.
 */

export interface SmsDelivery {
  delivered: boolean;
  /** Present only when delivery failed; safe for server logs. */
  reason?: 'not_configured' | 'provider_error';
}

export function smsConfigured(): boolean {
  return Boolean(process.env.SMS_API_KEY && process.env.SMS_SENDER && process.env.SMS_API_URL);
}

export async function sendOtpSms(phone: string, code: string): Promise<SmsDelivery> {
  if (!smsConfigured()) return { delivered: false, reason: 'not_configured' };

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
