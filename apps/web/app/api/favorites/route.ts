import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { addFavorite, listFavoriteIds, removeFavorite } from '@/lib/data/s2-store';

/**
 * Account favorites — the source of truth once a user is signed in.
 * Guests keep the device-local list (see FavoriteButton); every mutation here
 * is scoped to the session account id, never to a client-supplied user id.
 */
function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: 'برای ذخیره‌ی علاقه‌مندی‌ها وارد حساب خود شوید.' },
    { status: 401 },
  );
}

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return unauthorized();
  return NextResponse.json({ ids: await listFavoriteIds(session.sub) });
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
  const listingId = typeof (raw as { listingId?: unknown })?.listingId === 'string'
    ? (raw as { listingId: string }).listingId
    : '';
  if (!listingId) {
    return NextResponse.json({ error: 'شناسه آگهی لازم است.' }, { status: 400 });
  }

  await addFavorite(session.sub, listingId);
  return NextResponse.json({ ok: true, saved: true });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return unauthorized();

  const listingId = new URL(request.url).searchParams.get('listingId') ?? '';
  if (!listingId) {
    return NextResponse.json({ error: 'شناسه آگهی لازم است.' }, { status: 400 });
  }
  await removeFavorite(session.sub, listingId);
  return NextResponse.json({ ok: true, saved: false });
}
