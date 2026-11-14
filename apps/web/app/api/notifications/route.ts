import { NextResponse } from 'next/server';
import { DEFAULT_FILTERS } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { getLanguage, serverT } from '@/lib/i18n/server';
import { listFavoriteIds, listingById } from '@/lib/data/s2-store';
import { searchListings } from '@/lib/data/listings';
import { followedSellerIds, profileCustomization } from '@/lib/data/social-store';
import { listInspections, listStories } from '@/lib/data/platform-store';

type NotificationKind = 'saved_sold' | 'followed' | 'inspection';

interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  createdAt: string;
}

/**
 * Account-specific notifications, derived on read:
 *  - a saved listing that is now sold,
 *  - a new listing or story from a followed showroom,
 *  - a workshop inspection booking update.
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
  for (const listing of saved) {
    if (!listing || listing.state !== 'sold') continue;
    const title = listing.part ? listing.part.title : `${listing.model}${listing.trim ? ` ${listing.trim}` : ''}`;
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

  const [approvedStories, bookings] = await Promise.all([
    listStories('approved'),
    listInspections(),
  ]);
  const followedStories = approvedStories
    .filter((story) => followed.has(story.authorId))
    .slice(0, 4);
  const storyModes = await Promise.all(
    followedStories.map((story) => profileCustomization(story.authorId)),
  );
  followedStories.forEach((story, index) => {
    const publicAuthor = storyModes[index]?.profileMode === 'business';
    items.push({
      id: `followed-story-${story.id}`,
      kind: 'followed',
      title: t('استوری تازه از نمایشگاه دنبال‌شده', 'New story from a followed showroom'),
      body: t(`${story.title} منتشر شد.`, `${story.title} was just posted.`),
      // A personal author has no public seller URL; send the reader home.
      href: story.listingSlug
        ? `/listing/${story.listingSlug}`
        : publicAuthor
          ? `/seller/${story.authorId}?tab=stories`
          : '/',
      createdAt: story.createdAt,
    });
  });

  const ownBookings = bookings
    .filter((booking) => booking.phone === session.phone && booking.status !== 'cancelled')
    .slice(0, 4);
  for (const booking of ownBookings) {
    const confirmed = booking.status === 'confirmed' || booking.status === 'done';
    items.push({
      id: `inspection-${booking.id}-${booking.status}`,
      kind: 'inspection',
      title: confirmed
        ? t('نوبت کارشناسی تأیید شد', 'Inspection appointment confirmed')
        : t('وضعیت نوبت کارشناسی', 'Workshop inspection update'),
      body: t(
        `${booking.vehicle} — ${booking.date} ساعت ${booking.time}`,
        `${booking.vehicle} — ${booking.date} at ${booking.time}`,
      ),
      href: '/inspection',
      createdAt: booking.createdAt,
    });
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ items: items.slice(0, 14) });
}
