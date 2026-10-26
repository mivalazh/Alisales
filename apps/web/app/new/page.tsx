import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

export const metadata: Metadata = { title: 'ثبت آگهی خودرو' };

/**
 * Listing creation is NOT functional in S1 — it lands in S2 together with
 * login. The route exists so every «ثبت آگهی» entry leads somewhere honest
 * instead of a form that cannot actually publish.
 */
export default function NewListingPage() {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-card px-6 py-16 text-center">
      <Icon name="plus" size={40} className="mx-auto text-faint" />
      <h1 className="mt-4 text-lg font-extrabold">ثبت آگهی</h1>
      <p className="mt-2 text-sm text-muted">
        ثبت آگهی خودرو بزودی همراه با ورود به حساب کاربری ارائه می‌شود؛ در حال
        حاضر این بخش در دسترس نیست.
      </p>
      <Link href="/" className="btn-cta mt-6 inline-flex text-sm">
        بازگشت به آگهی‌ها
      </Link>
    </div>
  );
}
