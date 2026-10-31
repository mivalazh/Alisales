import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { ListingForm } from '@/components/ListingForm';

export const metadata: Metadata = { title: 'ثبت آگهی' };

/** Listing creation (S2): signed-in only, publishes immediately (C6). */
export default async function NewListingPage() {
  await requireUser('/new');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">ثبت آگهی</h1>
        <p className="mt-1 text-xs text-muted">
          آگهی شما پس از ثبت بلافاصله در فهرست منتشر می‌شود. شهر در این مرحله فقط کیش است.
        </p>
      </div>
      <ListingForm />
    </div>
  );
}
