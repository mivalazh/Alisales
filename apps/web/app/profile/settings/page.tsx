import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ACCOUNT_TYPE_LABELS, maskPhone } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { hasPassword } from '@/lib/auth/password';
import { LogoutButton } from '@/components/LogoutButton';
import { PasswordForm } from '@/components/PasswordForm';

export const metadata: Metadata = { title: 'تنظیمات حساب' };

/**
 * Account settings.
 *
 * The password is real now: setting one makes repeat logins instant on
 * /login (the SMS code stays available as the recovery path). Account deletion
 * is still an honest placeholder — the endpoint does not exist yet, so the row
 * says so instead of shipping a button that fails.
 */
export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/profile/settings');

  const passwordReady = hasPassword(session.phone);

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

      <section className="rounded-card border border-line bg-card p-4">
        <h2 className="font-extrabold">رمز عبور</h2>
        <p className="mt-0.5 text-xs text-muted">
          {passwordReady
            ? 'رمز عبور فعال است. برای تغییر، رمز فعلی را وارد کنید. ورود با کد پیامکی همیشه در دسترس است.'
            : 'با تعیین رمز عبور، بار بعد بدون انتظار برای پیامک وارد می‌شوید. ورود با کد پیامکی همیشه در دسترس است.'}
        </p>
        <PasswordForm hasPassword={passwordReady} />
      </section>

      <section className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-card p-4">
        <div>
          <h2 className="font-extrabold">حذف حساب</h2>
          <p className="mt-0.5 text-xs text-muted">
            حذف کامل حساب و آگهی‌ها در گام بعدی فعال می‌شود.
          </p>
        </div>
        <span className="rounded-[var(--radius-pill)] border border-line px-3 py-1 text-xs font-bold text-faint">
          به‌زودی
        </span>
      </section>

      <section className="rounded-card border border-line bg-card p-4">
        <LogoutButton />
      </section>
    </div>
  );
}
