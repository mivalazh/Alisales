import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { FREE_LISTING_LIMIT } from '@alisales/schemas';
import { activeListingsCount } from '@/lib/data/s2-store';
import { ListingForm } from '@/components/ListingForm';
import { PlanPreview } from '@/components/PlanPreview';

export const metadata: Metadata = { title: 'ثبت آگهی' };

/**
 * Listing creation (S2): signed-in only, publishes immediately (C6).
 *
 * At the two-active-listing free cap the form is replaced by the read-only
 * «بزودی» plan preview: no publish attempt, no payment call.
 */
export default async function NewListingPage() {
  const session = await requireUser('/new');
  const active = await activeListingsCount(session.sub);
  const atCap = active >= FREE_LISTING_LIMIT;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">ثبت آگهی</h1>
        <p className="mt-1 text-xs text-muted">
          آگهی شما پس از ثبت بلافاصله در فهرست منتشر می‌شود. شهر در این مرحله فقط کیش است.
        </p>
      </div>
      {atCap ? <PlanPreview /> : <ListingForm />}
    </div>
  );
}
