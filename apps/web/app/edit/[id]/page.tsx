import { localizedMetadata } from '@/lib/i18n/metadata';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/require-user';
import { getOwnerListing, getOwnerPhotos } from '@/lib/data/listings';
import { EditListingForm } from '@/components/EditListingForm';
import { getLanguage, serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'ویرایش آگهی' },
  { title: 'Edit listing' },
);

/**
 * Listing edit (owner only): `requireUser` guards the page, a missing row is a
 * real 404 and another account's listing redirects back to «آگهی‌های من».
 * Only editable values are handed to the client form — the brand/model/year
 * identity and the publishing clock stay server-owned.
 */
export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, lang] = await Promise.all([requireUser(`/edit/${id}`), getLanguage()]);
  const t = (fa: string, en: string) => serverT(lang, fa, en);

  const listing = await getOwnerListing(id);
  if (!listing) notFound();
  if (listing.sellerId !== session.sub) redirect('/profile/listings');

  const photos = await getOwnerPhotos(id);
  const title = listing.part
    ? listing.part.title
    : `${listing.model}${listing.trim ? ` ${listing.trim}` : ''} — ${listing.year}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold">{t('ویرایش آگهی', 'Edit listing')}</h1>
          <p className="mt-1 text-xs text-muted">
            {t(
              'تاریخ انتشار و سن آگهی با ویرایش تغییر نمی‌کند.',
              'Editing does not change the publish date or the age of the listing.',
            )}
          </p>
        </div>
        <Link href={`/listing/${listing.slug}`} className="text-xs font-bold text-muted underline">
          {t('مشاهده آگهی', 'View listing')}
        </Link>
      </div>

      <EditListingForm
        id={listing.id}
        slug={listing.slug}
        title={title}
        priceIRR={listing.priceIRR}
        description={listing.description ?? ''}
        allowPhoneReveal={listing.allowPhoneReveal}
        hideAed={listing.hideAed ?? false}
        photos={photos}
      />
    </div>
  );
}
