import { localizedMetadata } from '@/lib/i18n/metadata';
import { Icon } from '@/components/Icon';
import { MyTickets } from '@/components/MyTickets';
import { SupportForm } from '@/components/SupportForm';
import { SupportHelpCenter } from '@/components/SupportHelpCenter';
import { getLanguage, serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'پشتیبانی و راهنما' },
  { title: 'Help & support' },
);

export default async function SupportPage() {
  const lang = await getLanguage();
  const t = (fa: string, en: string) => serverT(lang, fa, en);

  return (
    <article className="mx-auto max-w-4xl space-y-5">
      <SupportForm kind="ticket" />

      <MyTickets />

      <SupportHelpCenter />

      <section className="grid gap-3 sm:grid-cols-3" aria-label={t('راه‌های تماس', 'Contact options')}>
        {[
          {
            icon: 'phone' as const,
            label: t('تلفن پشتیبانی', 'Support phone'),
            value: '0936 000 0000',
            href: 'tel:+989360000000',
            ltr: true,
          },
          {
            icon: 'message' as const,
            label: t('ایمیل مجموعه', 'Team email'),
            value: 'support@alisales.ir',
            href: 'mailto:support@alisales.ir',
            ltr: true,
          },
          {
            icon: 'clock' as const,
            label: t('ساعات پاسخگویی', 'Support hours'),
            value: t('شنبه تا پنجشنبه، ۹ تا ۱۸', 'Sat–Thu, 09:00–18:00'),
            href: '/support#ticket',
            ltr: false,
          },
        ].map((tile) => (
          <a
            key={tile.label}
            href={tile.href}
            className="rounded-card border border-line bg-card p-4 transition hover:border-line-strong hover:shadow-sm"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cta-soft text-cta">
              <Icon name={tile.icon} size={17} />
            </span>
            <p className="mt-2 text-[10px] font-bold text-muted">{tile.label}</p>
            <p className="mt-1 break-words text-sm font-extrabold text-ink" dir={tile.ltr ? 'ltr' : undefined}>
              {tile.value}
            </p>
          </a>
        ))}
      </section>
    </article>
  );
}
