import { NextResponse } from 'next/server';
import { safeNextPath } from '@alisales/schemas';
import { createSessionToken, setSessionCookie } from '@/lib/auth/session';
import { demoAuthMode } from '@/lib/config/mode';
import { createUser, findUserByPhone } from '@/lib/data/s2-store';

/**
 * GET /api/auth/demo?next=/new — demo seller sign-in.
 *
 * Without Supabase credentials and without an SMS provider there is no way to
 * receive a code, so «ثبت آگهی» would dead-end on the login form. This bridge
 * provisions (once) a clearly-labelled demo showroom account and signs it in,
 * then returns to a sanitized `?next=` path.
 *
 * It exists only in demo mode: with hosted data or an SMS provider configured
 * it answers 404, exactly like a route that was never deployed. The session is
 * the same signed cookie real logins use, so every ownership and quota check
 * still runs.
 */
const DEMO_PHONE = '09120000000';
const DEMO_NAME = 'فروشنده دمو (نمایشی)';

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get('next'), '/new');

  if (!demoAuthMode()) {
    return NextResponse.json({ error: 'not available' }, { status: 404 });
  }

  const account =
    (await findUserByPhone(DEMO_PHONE)) ??
    (await createUser({
      phone: DEMO_PHONE,
      displayName: DEMO_NAME,
      accountType: 'showroom',
    }));

  const token = await createSessionToken({
    sub: account.id,
    phone: account.phone,
    displayName: account.displayName,
    accountType: account.accountType,
  });
  await setSessionCookie(token);

  return NextResponse.redirect(new URL(next, url.origin));
}
