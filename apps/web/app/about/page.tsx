import { localizedMetadata } from '@/lib/i18n/metadata';
import { WORKSHOP_CREDIT, WORKSHOP_CREDIT_EN } from '@/components/Footer';
import { getLanguage } from '@/lib/i18n/server';
import { serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'درباره‌ی ما' },
  { title: 'About us' },
);

export default async function AboutPage() {
  const lang = await getLanguage();
  const t = (fa: string, en?: string) => serverT(lang, fa, en);
  return (
    <article className="mx-auto max-w-3xl space-y-4 text-sm leading-7">
      <h1 className="text-xl font-extrabold">{t('درباره‌ی Ali Sales', 'About Ali Sales')}</h1>
      <p className="text-muted">
        {t(
          'Ali Sales بازار خودرو و قطعات کیش است: خودروهای وارداتی لوکس تا خودروهای روزمره و قطعات یدکی، همه در یک فهرست با فیلترهای دقیق و آگهی‌های قابل اعتماد.',
          'Ali Sales is Kish’s marketplace for vehicles and parts: imported luxury cars, everyday vehicles and spare parts, all in one precise, filterable and trustworthy catalogue.',
        )}
      </p>
      <p className="rounded-card border border-[#F98513]/40 bg-[#FFF7EC] p-4 text-sm font-bold leading-7 text-ink dark:bg-[#2a2418]">
        {t(WORKSHOP_CREDIT, WORKSHOP_CREDIT_EN)}
      </p>
      <p className="text-muted">
        {t(
          'هدف ما ساده است: خریدار بدون تماس‌های بی‌مورد و فروشنده بدون هزینه‌های پنهان به هم برسند. نمایش آگهی رایگان است و پرداخت بین خود کاربران انجام می‌شود.',
          'Our goal is simple: connect buyers and sellers without unwanted calls or hidden fees. Posting is free and payment happens directly between users.',
        )}
      </p>
    </article>
  );
}
