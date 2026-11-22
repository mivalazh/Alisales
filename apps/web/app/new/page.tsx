import { localizedMetadata } from '@/lib/i18n/metadata';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { ListingForm } from '@/components/ListingForm';

export const generateMetadata = localizedMetadata(
  { title: 'ثبت آگهی' },
  { title: 'Post an ad' },
);

/**
 * Listing creation (S2): signed-in only, publishes immediately (C6).
 * Launch period: posting is free without a listing cap.
 *
 * `ListingForm` owns the page's single «ثبت آگهی» heading — a second one here
 * was duplicating the title.
 */
export default async function NewListingPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/new');
  return (
    <div className="space-y-4">
      <ListingForm />
    </div>
  );
}
