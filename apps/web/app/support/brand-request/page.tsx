import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { SupportForm } from '@/components/SupportForm';

export const metadata: Metadata = { title: 'درخواست افزودن خودرو یا برند' };

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
        <h1 className="text-xl font-extrabold">درخواست افزودن خودرو یا برند جدید</h1>
        <p className="mt-1 text-sm text-muted">
          خودرو یا برند مورد نظر را بنویسید تا در فهرست کاتالوگ قرار بگیرد.
        </p>
      </div>
      <SupportForm kind="brand" />
    </article>
  );
}
