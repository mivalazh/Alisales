import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FREE_LISTING_LIMIT } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { demoAuthMode } from '@/lib/config/mode';
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
  const session = await getSession();
  if (!session) {
    // Demo deployments have no SMS channel, so «ثبت آگهی» would stop at the
    // login form forever. Provision + sign in the demo seller instead; a real
    // deployment (Supabase or SMS configured) keeps the normal login guard.
    if (demoAuthMode()) redirect('/api/auth/demo?next=/new');
    redirect('/login?next=/new');
  }
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
