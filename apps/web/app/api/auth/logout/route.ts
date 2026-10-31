import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth/session';

/** POST /api/auth/logout — clears the signed session cookie. */
export async function POST(): Promise<NextResponse> {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
