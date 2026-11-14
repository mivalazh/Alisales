import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  followedSellerIds,
  isFollowing,
  toggleFollow,
} from '@/lib/data/social-store';

/**
 * Follow / unfollow a showroom.
 *
 * The account id comes from the session, never from the body: a buyer can only
 * ever follow on their own behalf. `GET` is used by the client button to hydrate
 * the state after a reload.
 */
function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: 'برای دنبال کردن نمایشگاه وارد حساب خود شوید.' },
    { status: 401 },
  );
}

export async function GET(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return unauthorized();
  const sellerId = new URL(request.url).searchParams.get('sellerId') ?? '';
  if (sellerId) {
    return NextResponse.json({ following: await isFollowing(session.sub, sellerId) });
  }
  return NextResponse.json({ sellerIds: await followedSellerIds(session.sub) });
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return unauthorized();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }
  const sellerId =
    typeof (raw as { sellerId?: unknown })?.sellerId === 'string'
      ? (raw as { sellerId: string }).sellerId.trim()
      : '';
  if (!sellerId) return NextResponse.json({ error: 'شناسه فروشنده لازم است.' }, { status: 400 });
  if (sellerId === session.sub) {
    return NextResponse.json({ error: 'نمی‌توانید نمایشگاه خودتان را دنبال کنید.' }, { status: 400 });
  }

  const following = await toggleFollow(session.sub, sellerId);
  return NextResponse.json({ ok: true, following });
}
