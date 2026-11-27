import { NextResponse } from 'next/server';
import { DEFAULT_FILTERS } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { getLanguage, serverT } from '@/lib/i18n/server';
import { listFavoriteRows, listingById } from '@/lib/data/s2-store';
import { searchListings } from '@/lib/data/listings';
import { followedSellerIds } from '@/lib/data/social-store';
import { listInspections } from '@/lib/data/platform-store';
import {
  listListingEvents,
  markNotificationItemRead,
  markNotificationsRead,
  notificationReadState,
} from '@/lib/data/notification-store';
import { dataUnavailableResponse } from '@/lib/http/data-unavailable';

type NotificationKind = 'saved_sold' | 'price_drop' | 'followed' | 'inspection';

interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  createdAt: string;
}

function toman(value: number): string {
  return Math.round(value / 10).toLocaleString('en-US');
}

function timeValue(iso: string): number {
  const time = Date.parse(iso);
  return Number.isFinite(time) ? time : 0;
}

/**
 * Account-specific notifications.
 *
 * Sold and price-drop items come from the server-side `listing_events`
 * history, scoped to listings this account saved before the event happened.
 * The read marker is also server-side, so another device sees the same unread
 * dot instead of trusting this browser's last local sync.
 *
 * Followed-showroom and inspection items stay derived from their own durable
 * rows. Bookmarking itself never creates an event.
 */
export async function GET(): Promise<NextResponse> {
  try {
    return await handleGet();
  } catch (error) {
    const unavailable = dataUnavailableResponse(error);
    if (unavailable) return unavailable;
    throw error;
  }
}

async function handleGet(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'برای دیدن اعلان‌ها وارد حساب شوید.' }, { status: 401 });
  }

  const [lang, favorites, followedIds, allListings, readState] = await Promise.all([
    getLanguage(),
    listFavoriteRows(session.sub),
    followedSellerIds(session.sub),
    searchListings(DEFAULT_FILTERS),
    notificationReadState(session.sub),
  ]);
  const t = (fa: string, en: string) => serverT(lang, fa, en);
  const followed = new Set(followedIds);
  const items: NotificationItem[] = [];

  const favoriteAt = new Map(favorites.map((favorite) => [favorite.listingId, favorite.createdAt]));
  const favoriteIds = favorites.map((favorite) => favorite.listingId);
  const [saved, events] = await Promise.all([
    Promise.all(favoriteIds.map((id) => listingById(id))),
    listListingEvents(favoriteIds),
  ]);
  const savedById = new Map(
    saved.filter((listing): listing is NonNullable<typeof listing> => Boolean(listing)).map((listing) => [listing.id, listing]),
  );

  for (const event of events) {
    const listing = savedById.get(event.listingId);
    if (!listing) continue;
    const savedAt = favoriteAt.get(event.listingId);
    // Only the accounts that had already saved the listing get the event.
    if (savedAt && timeValue(event.createdAt) < timeValue(savedAt)) continue;
    const title = listing.part
      ? listing.part.title
      : `${listing.model}${listing.trim ? ` ${listing.trim}` : ''}`;

    if (event.kind === 'sold') {
      items.push({
        id: `listing-event-${event.id}`,
        kind: 'saved_sold',
        title: t('آگهی ذخیره‌شده فروخته شد', 'A saved listing was sold'),
        body: t(`${title} اکنون به‌عنوان فروخته‌شده علامت خورده است.`, `${title} is now marked as sold.`),
        href: `/listing/${listing.slug}`,
        createdAt: event.createdAt,
      });
      continue;
    }

    if (event.previousPriceIRR === null || event.priceIRR === null) continue;
    items.push({
      id: `listing-event-${event.id}`,
      kind: 'price_drop',
      title: t('کاهش قیمت آگهی ذخیره‌شده', 'Saved listing price dropped'),
      body: t(
        `${title}: از ${toman(event.previousPriceIRR)} به ${toman(event.priceIRR)} تومان`,
        `${title}: from ${toman(event.previousPriceIRR)} to ${toman(event.priceIRR)} Toman`,
      ),
      href: `/listing/${listing.slug}`,
      createdAt: event.createdAt,
    });
  }

  const followedListings = allListings
    .filter((listing) => followed.has(listing.sellerId) && listing.state === 'active')
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    .slice(0, 6);
  for (const listing of followedListings) {
    const title = listing.part ? listing.part.title : `${listing.model}${listing.trim ? ` ${listing.trim}` : ''}`;
    items.push({
      id: `followed-listing-${listing.id}`,
      kind: 'followed',
      title: t('آگهی تازه از نمایشگاه دنبال‌شده', 'New listing from a followed showroom'),
      body: t(`${title} در فهرست نمایشگاه مورد دنبال‌شما ثبت شد.`, `${title} was added by a showroom you follow.`),
      href: `/listing/${listing.slug}`,
      createdAt: listing.publishedAt ?? new Date().toISOString(),
    });
  }

  const bookings = await listInspections();
  const confirmedBookings = bookings
    .filter(
      (booking) =>
        booking.phone === session.phone &&
        (booking.status === 'confirmed' || booking.status === 'done'),
    )
    .slice(0, 4);
  for (const booking of confirmedBookings) {
    items.push({
      id: `inspection-${booking.id}-${booking.status}`,
      kind: 'inspection',
      title: t('نوبت کارشناسی تأیید شد', 'Inspection appointment confirmed'),
      body: t(
        `${booking.vehicle} — ${booking.date} ساعت ${booking.time}`,
        `${booking.vehicle} — ${booking.date} at ${booking.time}`,
      ),
      href: '/inspection',
      createdAt: booking.createdAt,
    });
  }

  items.sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt));
  return NextResponse.json({
    items: items.slice(0, 14),
    readAt: readState.readAt,
    readIds: readState.readIds,
  });
}

/**
 * Mark bell items as read on every device.
 *
 * With `{ itemId }` exactly that item is marked (a single click clears one
 * badge); without a body it is «mark all», as before.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'برای تغییر اعلان‌ها وارد حساب شوید.' }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => null)) as {
      itemId?: unknown;
    } | null;
    const itemId = typeof body?.itemId === 'string' ? body.itemId : '';
    if (itemId) {
      const readIds = await markNotificationItemRead(session.sub, itemId);
      return NextResponse.json({ ok: true, itemId, readIds });
    }
    // Never answer "ok" with a timestamp the database did not store.
    const readAt = await markNotificationsRead(session.sub);
    return NextResponse.json({ ok: true, readAt });
  } catch (error) {
    const unavailable = dataUnavailableResponse(error);
    if (unavailable) return unavailable;
    throw error;
  }
}
