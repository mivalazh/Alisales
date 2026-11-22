import { NextResponse } from 'next/server';
import { authSecretReadiness } from '@/lib/auth/session';
import { smsReadiness } from '@/lib/auth/sms';
import { instantOtpAllowlistSize, sandboxOtpFallbackEnabled } from '@/lib/config/mode';
import { dataPathChecks } from '@/lib/health/data-probes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health — deployment readiness for security-critical configuration
 * and for the production data path.
 *
 * Besides the session secret and login provider, this exercises the two paths
 * a listing actually travels: one row written/read/deleted in Supabase and one
 * object uploaded/downloaded/deleted in the photo bucket. A missing
 * service-role key, unapplied migration or missing bucket is therefore a
 * failing health check, not listings that save nowhere.
 *
 * The body is safe to serve publicly: it contains variable names, resource
 * names and reason codes, never secret values or provider error text (that goes
 * to the server log). A failing check answers 503 so uptime monitors and
 * deployment smoke tests fail before users discover the broken path.
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

  const data = await dataPathChecks();
  const sandboxFallback = sandboxOtpFallbackEnabled();
  // The real account-takeover boundary: with a provider configured, every
  // allowlisted number can sign in from an on-screen code the moment delivery
  // fails, whether or not the legacy flag is set.
  const automaticFallback = sms.configured && allowlistCount > 0;
  // One entry per risk that is actually present.
  const warnings = [
    sandboxFallback &&
      'ALLOW_SANDBOX_OTP_FALLBACK is enabled but no longer needed: in production it can only permit numbers already on INSTANT_OTP_ALLOWLIST, which receive the on-screen code automatically when SMS delivery fails. Unset it and trim INSTANT_OTP_ALLOWLIST instead (LOGIN_RUNBOOK.md).',
    automaticFallback &&
      `INSTANT_OTP_ALLOWLIST has ${allowlistCount} number(s): when a configured provider cannot deliver (sandbox/unverified account, template rejection, provider error), those numbers can sign in with an on-screen code without proving they hold the phone. Keep the list minimal and prefer no moderation numbers (LOGIN_RUNBOOK.md).`,
  ].filter((warning): warning is string => Boolean(warning));

  const ok = authSecret.ok && loginReady && data.database.ok && data.storage.ok;
  const body = {
    ok,
    ...(warnings.length > 0 ? { warnings } : {}),
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
      // `enabled` is the legacy flag; `automatic` is the behaviour that
      // actually ships: allowlisted numbers get the on-screen code whenever a
      // configured provider fails to deliver.
      sandboxFallback: {
        enabled: sandboxFallback,
        allowlistCount,
        automatic: automaticFallback,
      },
      login: loginReady
        ? {
            ok: true,
            mode: sms.configured ? 'sms' : 'instant-allowlist',
          }
        : { ok: false, ...loginFailure },
      // Round-trip proofs for the production data path, one check each.
      database: data.database,
      storage: data.storage,
    },
  };

  return NextResponse.json(body, {
    status: ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
