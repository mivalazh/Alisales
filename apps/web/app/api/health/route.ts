import { NextResponse } from 'next/server';
import { authSecretReadiness } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health — deployment readiness for security-critical configuration.
 *
 * The body is safe to serve publicly: it contains a reason code, never the
 * secret value or its length. A failing check answers 503 so uptime monitors
 * and deployment smoke tests fail before users discover the broken login.
 */
export async function GET(): Promise<NextResponse> {
  const authSecret = authSecretReadiness();
  const body = authSecret.ok
    ? {
        ok: true,
        checks: {
          authSecret: { ok: true, source: authSecret.source },
        },
      }
    : {
        ok: false,
        checks: {
          authSecret: {
            ok: false,
            code:
              authSecret.reason === 'missing'
                ? 'AUTH_SECRET_MISSING'
                : 'AUTH_SECRET_TOO_SHORT',
            message:
              authSecret.reason === 'missing'
                ? 'AUTH_SECRET is not set; session cookie signing is disabled.'
                : 'AUTH_SECRET is shorter than 16 characters; session cookie signing is disabled.',
          },
        },
      };

  return NextResponse.json(body, {
    status: authSecret.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
