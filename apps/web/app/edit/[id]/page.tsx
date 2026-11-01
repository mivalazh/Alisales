import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/require-user';
import { getOwnerListing, getOwnerPhotos } from '@/lib/data/listings';
import { EditListingForm } from '@/components/EditListingForm';

export const metadata: Metadata = { title: 'ویرایش آگهی' };

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
  const session = await requireUser(`/edit/${id}`);

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
          <h1 className="text-xl font-extrabold">ویرایش آگهی</h1>
          <p className="mt-1 text-xs text-muted">
            تاریخ انتشار و سن آگهی با ویرایش تغییر نمی‌کند.
          </p>
        </div>
        <Link href={`/listing/${listing.slug}`} className="text-xs font-bold text-muted underline">
          مشاهده آگهی
        </Link>
      </div>

      <EditListingForm
        id={listing.id}
        slug={listing.slug}
        title={title}
        priceIRR={listing.priceIRR}
        description={listing.description ?? ''}
        allowPhoneReveal={listing.allowPhoneReveal}
        photos={photos}
      />
    </div>
  );
}
