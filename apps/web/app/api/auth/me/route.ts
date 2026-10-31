import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

/** GET /api/auth/me — the current account, or 401 for guests. */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'وارد حساب خود نشده‌اید.' }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      id: session.sub,
      phone: session.phone,
      displayName: session.displayName,
      accountType: session.accountType,
    },
  });
}
