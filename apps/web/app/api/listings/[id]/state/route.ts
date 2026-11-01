import { NextResponse } from 'next/server';
import { FREE_LISTING_LIMIT, FREE_THIRD_LISTING_MESSAGE, canTransition, listingStateChangeSchema, type ListingState } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { activeListingsCount, admin, listingById } from '@/lib/data/s2-store';
import { updateDevListing } from '@/lib/data/dev-store';

/**
 * POST /api/listings/{id}/state — owner lifecycle actions.
 *
 * Allowed transitions are the shared owner set: active → paused / sold,
 * paused → active, sold → active (reactivation, 0005). The service-role write
 * bypasses the DB trigger, so the same rules are enforced here.
 *
 * Reactivation obeys the two-active-listing free cap: a paused or sold listing
 * may only return to `active` while the owner has fewer than two active ones.
 * Only `state` (and `sold_at`) is written — `published_at` stays put, so the
 * posting age of an edited or reactivated listing never resets.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'برای تغییر وضعیت آگهی وارد حساب شوید.' }, { status: 401 });
  }

  const { id } = await context.params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }
  const parsed = listingStateChangeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'وضعیت درخواستی معتبر نیست.' }, { status: 400 });
  }
  const next = parsed.data.state;

  const sb = admin();
  if (sb) {
    const { data } = await sb
      .from('listings')
      .select('id, created_by, state')
      .eq('id', id)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: 'آگهی پیدا نشد.' }, { status: 404 });
    if (String(data.created_by) !== session.sub) {
      return NextResponse.json({ error: 'این آگهی متعلق به شما نیست.' }, { status: 403 });
    }
    const current = String(data.state) as ListingState;
    if (!canTransition(current, next, 'owner')) {
      return NextResponse.json(
        { error: 'این تغییر وضعیت برای آگهی مجاز نیست.' },
        { status: 400 },
      );
    }
    if (next === 'active') {
      const active = await activeListingsCount(session.sub);
      if (active >= FREE_LISTING_LIMIT) {
        return NextResponse.json(
          { error: FREE_THIRD_LISTING_MESSAGE, planRequired: true },
          { status: 403 },
        );
      }
    }
    const fields: Record<string, unknown> =
      next === 'sold'
        ? { state: 'sold', sold_at: new Date().toISOString() }
        : { state: next };
    const updated = await sb.from('listings').update(fields).eq('id', id);
    if (updated.error) {
      return NextResponse.json(
        { error: 'تغییر وضعیت انجام نشد؛ دوباره تلاش کنید.' },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, state: next });
  }

  const listing = await listingById(id);
  if (!listing) return NextResponse.json({ error: 'آگهی پیدا نشد.' }, { status: 404 });
  if (listing.sellerId !== session.sub) {
    return NextResponse.json({ error: 'این آگهی متعلق به شما نیست.' }, { status: 403 });
  }
  if (!canTransition(listing.state, next, 'owner')) {
    return NextResponse.json({ error: 'این تغییر وضعیت برای آگهی مجاز نیست.' }, { status: 400 });
  }
  if (next === 'active') {
    const active = await activeListingsCount(session.sub);
    if (active >= FREE_LISTING_LIMIT) {
      return NextResponse.json(
        { error: FREE_THIRD_LISTING_MESSAGE, planRequired: true },
        { status: 403 },
      );
    }
  }
  updateDevListing(id, { state: next });
  return NextResponse.json({ ok: true, state: next });
}
