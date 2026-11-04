import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { adminGate } from '@/lib/admin/guard';
import { getAedRate } from '@/lib/data/rate-store';
import { AdminRateForm } from '@/components/AdminRateForm';
import { Icon } from '@/components/Icon';

export const metadata: Metadata = { title: 'تنظیمات' };

/**
 * Owner settings that are global to the marketplace.
 *
 * Today that is the AED reference rate — the single value behind every dirham
 * figure on the site. Guests are redirected to login, signed-in non-owners get
 * the honest 404 the rest of the moderation hub uses.
 */
export default async function AdminSettingsPage() {
  const { session, access } = await adminGate();
  if (access === 'guest') redirect('/login?next=/admin/settings');
  if (access !== 'admin' || !session) notFound();

  const rate = await getAedRate();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold">تنظیمات</h1>
          <p className="mt-1 text-xs text-muted">مقادیر سراسری سایت.</p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-muted transition hover:text-ink"
        >
          <Icon name="arrowLeft" size={16} />
          پنل مدیریت
        </Link>
      </div>

      <AdminRateForm initial={rate} />
    </div>
  );
}
