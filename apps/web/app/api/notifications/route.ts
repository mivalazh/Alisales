import { NextResponse } from 'next/server';
import { DEFAULT_FILTERS } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { getLanguage, serverT } from '@/lib/i18n/server';
import { listFavoriteIds, listingById } from '@/lib/data/s2-store';
import { searchListings } from '@/lib/data/listings';
import { followedSellerIds } from '@/lib/data/social-store';
import { listInspections } from '@/lib/data/platform-store';

type NotificationKind = 'saved_sold' | 'followed' | 'inspection';

interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  createdAt: string;
}

interface WatchedListing {
  id: string;
  slug: string;
  title: string;
  priceIRR: number;
  state: string;
}

/**
 * Account-specific notifications, derived on read:
 *  - a saved listing that is now sold,
 *  - a new listing from a followed showroom,
 *  - a confirmed workshop inspection booking.
 *
 * Bookmarking itself never creates an event. Current favorite prices ride
 * along in `watched` so the browser can detect a real decrease against its
 * previous baseline without a write queue.
 *
 * Read state is deliberately device-local (the bell's «خواندن همه» marker), so
 * the endpoint never needs a write queue just to show an unread dot.
 */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'برای دیدن اعلان‌ها وارد حساب شوید.' }, { status: 401 });
  }

  const [lang, favoriteIds, followedIds, allListings] = await Promise.all([
    getLanguage(),
    listFavoriteIds(session.sub),
    followedSellerIds(session.sub),
    searchListings(DEFAULT_FILTERS),
  ]);
  const t = (fa: string, en: string) => serverT(lang, fa, en);
  const followed = new Set(followedIds);
  const items: NotificationItem[] = [];

  const saved = await Promise.all(favoriteIds.map((id) => listingById(id)));
  const watched: WatchedListing[] = [];
  for (const listing of saved) {
    if (!listing) continue;
    const title = listing.part ? listing.part.title : `${listing.model}${listing.trim ? ` ${listing.trim}` : ''}`;
    watched.push({
      id: listing.id,
      slug: listing.slug,
      title,
      priceIRR: listing.priceIRR,
      state: listing.state,
    });
    if (listing.state !== 'sold') continue;
    items.push({
      id: `saved-sold-${listing.id}`,
      kind: 'saved_sold',
      title: t('آگهی ذخیره‌شده فروخته شد', 'A saved listing was sold'),
      body: t(`${title} اکنون به‌عنوان فروخته‌شده علامت خورده است.`, `${title} is now marked as sold.`),
      href: `/listing/${listing.slug}`,
      createdAt: listing.publishedAt ?? new Date().toISOString(),
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

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ items: items.slice(0, 14), watched });
}
