import { localizedMetadata } from '@/lib/i18n/metadata';
import { Icon } from '@/components/Icon';
import { SupportTicketCenter } from '@/components/SupportTicketCenter';
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
    <article className="mx-auto mt-3 max-w-4xl space-y-5 sm:mt-4">
      <SupportTicketCenter />

      <SupportHelpCenter />

      {/* Support runs on one written channel: the phone tile is gone and the
          email address is the only contact card left. */}
      <section
        className="grid gap-3 sm:max-w-sm"
        aria-label={t('راه‌های تماس', 'Contact options')}
      >
        <a
          href="mailto:support@alisales.ir"
          className="flex items-center gap-3 rounded-card border border-line bg-card p-4 transition hover:border-line-strong hover:shadow-sm"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cta-soft text-cta">
            <Icon name="message" size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-bold text-muted">
              {t('ایمیل پشتیبانی', 'Support email')}
            </span>
            <span className="mt-0.5 block break-words text-sm font-extrabold text-ink" dir="ltr">
              support@alisales.ir
            </span>
          </span>
        </a>
      </section>
    </article>
  );
}
