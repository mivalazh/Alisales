import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { SupportForm } from '@/components/SupportForm';

export const metadata: Metadata = { title: 'پیشنهادات شما برای بهتر کردن سایت' };

export default function BrandRequestPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/support"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted transition hover:text-ink"
      >
        <Icon name="arrowLeft" size={18} />
        بازگشت به پشتیبانی
      </Link>
      <div>
        <h1 className="text-xl font-extrabold">پیشنهادات شما برای بهتر کردن سایت</h1>
        <p className="mt-1 text-sm text-muted">
          خودرو، برند، قطعه یا هر تغییری که دوست دارید در آلی‌سیلز ببینید را بنویسید؛
          پیشنهادها در نوبت بررسی تیم محصول قرار می‌گیرد.
        </p>
      </div>
      <SupportForm kind="brand" />
    </article>
  );
}
