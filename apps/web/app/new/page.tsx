import { localizedMetadata } from '@/lib/i18n/metadata';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { ListingForm } from '@/components/ListingForm';
import { getLanguage, serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'ثبت آگهی' },
  { title: 'Post an ad' },
);

/**
 * Listing creation (S2): signed-in only, publishes immediately (C6).
 * Launch period: posting is free without a listing cap.
 */
export default async function NewListingPage() {
  const lang = await getLanguage();
  const t = (fa: string, en: string) => serverT(lang, fa, en);
  const session = await getSession();
  if (!session) redirect('/login?next=/new');
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">{t('ثبت آگهی', 'Post ad')}</h1>
      </div>
      <ListingForm />
    </div>
  );
}
