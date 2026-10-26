import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

export const metadata: Metadata = { title: 'چت‌ها' };

/** Chats — the messaging product lands in Phase 6; the route exists now. */
export default function ChatsPage() {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-card px-6 py-16 text-center">
      <Icon name="message" size={40} className="mx-auto text-faint" />
      <h1 className="mt-4 text-lg font-extrabold">چت‌ها</h1>
      <p className="mt-2 text-sm text-muted">
        پیام‌رسان داخلی Alisales بزودی ارائه می‌شود. تا آن زمان می‌توانید از تماس
        تلفنی فروشندگانی که شماره‌شان را منتشر کرده‌اند استفاده کنید.
      </p>
      <Link href="/" className="btn-cta mt-6 inline-flex text-sm">
        بازگشت به آگهی‌ها
      </Link>
    </div>
  );
}
