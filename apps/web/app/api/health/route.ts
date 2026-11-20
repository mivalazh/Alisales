import { NextResponse } from 'next/server';
import { authSecretReadiness } from '@/lib/auth/session';
import { smsReadiness } from '@/lib/auth/sms';
import { instantOtpAllowlistSize } from '@/lib/config/mode';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health — deployment readiness for security-critical configuration.
 *
 * The body is safe to serve publicly: it contains variable names and reason
 * codes, never secret values. A failing check answers 503 so uptime monitors
 * and deployment smoke tests fail before users discover the broken login.
 */
export async function GET(): Promise<NextResponse> {
  const authSecret = authSecretReadiness();
  const sms = smsReadiness();
  const allowlistCount = instantOtpAllowlistSize();
  const instantOtpReady = !sms.configured && allowlistCount > 0;
  const loginReady = sms.configured || instantOtpReady;

  let loginFailure:
    | { code: string; message: string }
    | null = null;
  if (!loginReady) {
    if (sms.provider === 'sms_ir' && sms.missing.includes('SMS_IR_TEMPLATE_ID')) {
      loginFailure = {
        code: 'SMS_IR_TEMPLATE_ID_MISSING',
        message:
          'SMS_IR_API_KEY is set but SMS_IR_TEMPLATE_ID is missing; SMS.ir delivery is disabled.',
      };
    } else if (sms.provider === 'generic') {
      loginFailure = {
        code: 'SMS_GENERIC_CONFIG_INCOMPLETE',
        message:
          'The generic SMS provider needs SMS_API_KEY, SMS_SENDER and SMS_API_URL together.',
      };
    } else {
      loginFailure = {
        code: 'SMS_NOT_CONFIGURED',
        message:
          'No SMS provider is configured and INSTANT_OTP_ALLOWLIST is empty; no production login path is available.',
      };
    }
  }

  const ok = authSecret.ok && loginReady;
  const body = {
    ok,
    checks: {
      authSecret: authSecret.ok
        ? { ok: true, source: authSecret.source }
        : {
            ok: false,
            code:
              authSecret.reason === 'missing'
                ? 'AUTH_SECRET_MISSING'
                : 'AUTH_SECRET_TOO_SHORT',
            message:
              authSecret.reason === 'missing'
                ? 'Neither AUTH_SECRET nor SESSION_SECRET is set; session cookie signing is disabled.'
                : 'AUTH_SECRET/SESSION_SECRET is shorter than 16 characters; session cookie signing is disabled.',
          },
      sms: {
        ok: sms.configured,
        configured: sms.configured,
        provider: sms.provider,
        missing: sms.missing,
        templateIdConfigured: sms.templateIdConfigured,
      },
      instantOtp: {
        ready: instantOtpReady,
        allowlistCount,
      },
      login: loginReady
        ? {
            ok: true,
            mode: sms.configured ? 'sms' : 'instant-allowlist',
          }
        : { ok: false, ...loginFailure },
    },
  };

  return NextResponse.json(body, {
    status: ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
