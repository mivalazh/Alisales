import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

export const metadata: Metadata = { title: 'ورود' };

/** Login — phone OTP auth arrives in Phase 4; the route exists for nav. */
export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md rounded-card border border-dashed border-line-strong bg-card px-6 py-16 text-center">
      <Icon name="user" size={40} className="mx-auto text-faint" />
      <h1 className="mt-4 text-lg font-extrabold">ورود به حساب</h1>
      <p className="mt-2 text-sm text-muted">
        ورود با شماره موبایل (کد یک‌بارمصرف) بزودی ارائه می‌شود. تا آن زمان می‌توانید
        بدون حساب آگهی‌ها را مرور کنید.
      </p>
      <Link href="/" className="btn-cta mt-6 inline-flex text-sm">
        مرور آگهی‌ها
      </Link>
    </div>
  );
}
