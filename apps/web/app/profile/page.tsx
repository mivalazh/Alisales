import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

export const metadata: Metadata = { title: 'پروفایل' };

/** Profile — accounts and seller panel arrive in Phase 4. */
export default function ProfilePage() {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-card px-6 py-16 text-center">
      <Icon name="user" size={40} className="mx-auto text-faint" />
      <h1 className="mt-4 text-lg font-extrabold">پروفایل</h1>
      <p className="mt-2 text-sm text-muted">
        حساب کاربری، مدیریت آگهی‌ها و پنل فروشندگی بزودی ارائه می‌شود.
      </p>
      <Link href="/new" className="btn-cta mt-6 inline-flex text-sm">
        ثبت آگهی رایگان
      </Link>
    </div>
  );
}
