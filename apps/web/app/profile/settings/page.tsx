import { localizedMetadata } from '@/lib/i18n/metadata';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { maskPhone, profileModeFor } from '@alisales/schemas';
import { profileCustomization } from '@/lib/data/social-store';
import { AccountModeForm } from '@/components/AccountModeForm';
import { getSession } from '@/lib/auth/session';
import { hasPassword } from '@/lib/auth/password';
import { LogoutButton } from '@/components/LogoutButton';
import { PasswordForm } from '@/components/PasswordForm';
import { getLanguage, serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'تنظیمات حساب' },
  { title: 'Account settings' },
);

/**
 * Account settings.
 *
 * The password is real now: setting one makes repeat logins instant on
 * /login (the SMS code stays available as the recovery path). Account deletion
 * is still an honest placeholder — the endpoint does not exist yet, so the row
 * says so instead of shipping a button that fails.
 */
export default async function SettingsPage() {
  const [session, lang] = await Promise.all([getSession(), getLanguage()]);
  if (!session) redirect('/login?next=/profile/settings');
  const t = (fa: string, en: string) => serverT(lang, fa, en);

  const passwordReady = hasPassword(session.phone);
  const custom = profileCustomization(session.sub);
  const profileMode = custom?.profileMode ?? profileModeFor(session.accountType);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">{t('تنظیمات حساب', 'Account settings')}</h1>
        <Link href="/profile" className="text-xs font-bold text-muted underline">
          {t('بازگشت به پروفایل', 'Back to profile')}
        </Link>
      </div>

      <section className="rounded-card border border-line bg-card p-4">
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-faint">{t('نام نمایشی', 'Display name')}</dt>
            <dd className="font-bold">{session.displayName}</dd>
          </div>
          <div>
            <dt className="text-xs text-faint">{t('شماره موبایل', 'Mobile number')}</dt>
            <dd className="font-bold" dir="ltr">
              {maskPhone(session.phone)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-faint">{t('نوع پروفایل', 'Profile type')}</dt>
            <dd className="font-bold">
              {profileMode === 'business'
                ? t('حساب کسب‌وکار', 'Business account')
                : t('حساب شخصی', 'Personal account')}
            </dd>
          </div>
        </dl>
      </section>

      <AccountModeForm
        initialMode={profileMode}
        initialBusinessType={custom?.businessType ?? null}
      />

      <section className="rounded-card border border-line bg-card p-4">
        <h2 className="font-extrabold">{t('رمز عبور', 'Password')}</h2>
        <p className="mt-0.5 text-xs text-muted">
          {passwordReady
            ? t(
                'رمز عبور فعال است. برای تغییر، رمز فعلی را وارد کنید. ورود با کد پیامکی همیشه در دسترس است.',
                'A password is active. Enter the current one to change it. SMS sign-in is always available.',
              )
            : t(
                'با تعیین رمز عبور، بار بعد بدون انتظار برای پیامک وارد می‌شوید. ورود با کد پیامکی همیشه در دسترس است.',
                'Set a password to sign in next time without waiting for an SMS. SMS sign-in is always available.',
              )}
        </p>
        <PasswordForm hasPassword={passwordReady} />
      </section>

      <section className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-card p-4">
        <div>
          <h2 className="font-extrabold">{t('حذف حساب', 'Delete account')}</h2>
          <p className="mt-0.5 text-xs text-muted">
            {t(
              'حذف کامل حساب و آگهی‌ها در گام بعدی فعال می‌شود.',
              'Full account and listing deletion will be enabled in a later release.',
            )}
          </p>
        </div>
        <span className="rounded-[var(--radius-pill)] border border-line px-3 py-1 text-xs font-bold text-faint">
          {t('به‌زودی', 'Coming soon')}
        </span>
      </section>

      <section className="rounded-card border border-line bg-card p-4">
        <LogoutButton />
      </section>
    </div>
  );
}
