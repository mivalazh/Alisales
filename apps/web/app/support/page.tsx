import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

export const metadata: Metadata = { title: 'تماس با پشتیبانی' };

const ACTIONS = [
  {
    href: '/support/brand-request',
    label: 'درخواست افزودن خودرو یا برند جدید',
    hint: 'اگر خودرو یا برند مورد نظر شما در فهرست نیست، مدل را برای ما ثبت کنید.',
    icon: 'plus' as const,
  },
  {
    href: '/support/ticket',
    label: 'پشتیبانی و ثبت تیکت',
    hint: 'برای گزارش آگهی نامناسب، مشکل ورود یا سؤال درباره‌ی ثبت آگهی تیکت بزنید.',
    icon: 'message' as const,
  },
];

export default function SupportPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 text-sm leading-7">
      <h1 className="text-xl font-extrabold">تماس با پشتیبانی</h1>
      <p className="text-muted">
        برای گزارش آگهی نامناسب، مشکل در ورود یا سؤال درباره‌ی ثبت آگهی با ما در تماس باشید.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex h-full flex-col gap-2 rounded-card border border-line bg-card p-4 transition hover:border-line-strong hover:bg-cta-soft"
          >
            <span className="flex items-center gap-2 font-extrabold text-ink">
              <Icon name={action.icon} size={20} className="text-cta" />
              {action.label}
            </span>
            <span className="text-xs leading-6 text-muted">{action.hint}</span>
          </Link>
        ))}
      </div>

      <ul className="space-y-2">
        <li className="rounded-card border border-line bg-card p-4">
          <span className="font-bold">ایمیل: </span>
          <span dir="ltr" className="font-mono text-xs">
            support@alisales.example
          </span>
        </li>
        <li className="rounded-card border border-line bg-card p-4">
          <span className="font-bold">ساعات پاسخ‌دهی: </span>
          شنبه تا پنجشنبه، ۹ تا ۱۸
        </li>
      </ul>
      <p className="text-xs text-faint">
        برای پیگیری سریع‌تر، شناسه‌ی آگهی یا شماره موبایل حساب خود را در پیام بنویسید.
      </p>
    </article>
  );
}
