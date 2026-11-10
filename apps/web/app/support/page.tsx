import { localizedMetadata } from '@/lib/i18n/metadata';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getLanguage } from '@/lib/i18n/server';
import { serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'تماس با پشتیبانی' },
  { title: 'Contact support' },
);

const ACTIONS = [
  {
    href: '/support/brand-request',
    label: 'پیشنهادات شما برای بهتر کردن سایت',
    hint: 'هر ایده‌ای برای بهتر شدن Ali Sales دارید — برند تازه، قابلیت جدید یا تغییری در تجربه‌ی خرید — همین‌جا ثبت کنید.',
    icon: 'plus' as const,
  },
  {
    href: '/support/ticket',
    label: 'پشتیبانی و ثبت تیکت',
    hint: 'برای گزارش آگهی نامناسب، مشکل ورود یا سؤال درباره‌ی ثبت آگهی تیکت بزنید.',
    icon: 'message' as const,
  },
];

export default async function SupportPage() {
  const lang = await getLanguage();
  const t = (fa: string, en?: string) => serverT(lang, fa, en);
  return (
    <article className="mx-auto max-w-3xl space-y-4 text-sm leading-7">
      <h1 className="text-xl font-extrabold">{t('تماس با پشتیبانی')}</h1>
      <p className="text-muted">
        {t(
          'برای گزارش آگهی نامناسب، مشکل در ورود یا سؤال درباره‌ی ثبت آگهی با ما در تماس باشید.',
          'Contact us to report a listing, resolve a sign-in problem or ask about posting an ad.',
        )}
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
              {t(action.label)}
            </span>
            <span className="text-xs leading-6 text-muted">{t(action.hint)}</span>
          </Link>
        ))}
      </div>

      <ul className="space-y-2">
        <li className="rounded-card border border-line bg-card p-4">
          <span className="font-bold">{t('ایمیل', 'Email')}: </span>
          <span dir="ltr" className="font-mono text-xs">
            support@alisales.example
          </span>
        </li>
        <li className="rounded-card border border-line bg-card p-4">
          <span className="font-bold">{t('ساعات پاسخ‌دهی', 'Support hours')}: </span>
          {t('شنبه تا پنجشنبه، ۹ تا ۱۸', 'Saturday to Thursday, 09:00–18:00')}
        </li>
      </ul>
      <p className="text-xs text-faint">
        {t(
          'برای پیگیری سریع‌تر، شناسه‌ی آگهی یا شماره موبایل حساب خود را در پیام بنویسید.',
          'Include the listing reference or your account mobile number so we can help faster.',
        )}
      </p>
    </article>
  );
}
