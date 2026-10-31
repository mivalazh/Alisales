import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ACCOUNT_TYPE_LABELS, maskPhone } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { LogoutButton } from '@/components/LogoutButton';

export const metadata: Metadata = { title: 'تنظیمات حساب' };

/**
 * Account settings. The optional password (C7) and account deletion are
 * deliberately UI placeholders for this stage: the row is visible and honest
 * about not being available yet, and no half-working credential path ships.
 */
export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/profile/settings');

  const rows = [
    {
      title: 'رمز عبور اختیاری',
      body: 'ورود دوم with رمز، در گام بعدی ارائه می‌شود؛ ورود اصلی همان کد یک‌بارمصرف پیامکی است.',
      action: 'به‌زودی',
    },
    {
      title: 'حذف حساب',
      body: 'حذف کامل حساب و آگهی‌ها در گام بعدی فعال می‌شود.',
      action: 'به‌زودی',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">تنظیمات حساب</h1>
        <Link href="/profile" className="text-xs font-bold text-muted underline">
          بازگشت به پروفایل
        </Link>
      </div>

      <section className="rounded-card border border-line bg-card p-4">
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-faint">نام نمایشی</dt>
            <dd className="font-bold">{session.displayName}</dd>
          </div>
          <div>
            <dt className="text-xs text-faint">شماره موبایل</dt>
            <dd className="font-bold" dir="ltr">
              {maskPhone(session.phone)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-faint">نوع حساب</dt>
            <dd className="font-bold">{ACCOUNT_TYPE_LABELS[session.accountType]}</dd>
          </div>
        </dl>
      </section>

      {rows.map((row) => (
        <section
          key={row.title}
          className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-card p-4"
        >
          <div>
            <h2 className="font-extrabold">{row.title}</h2>
            <p className="mt-0.5 text-xs text-muted">{row.body}</p>
          </div>
          <span className="rounded-[var(--radius-pill)] border border-line px-3 py-1 text-xs font-bold text-faint">
            {row.action}
          </span>
        </section>
      ))}

      <section className="rounded-card border border-line bg-card p-4">
        <LogoutButton />
      </section>
    </div>
  );
}
