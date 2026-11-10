import { localizedMetadata } from '@/lib/i18n/metadata';
import { getLanguage } from '@/lib/i18n/server';
import { serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'قوانین و حریم خصوصی' },
  { title: 'Terms & Privacy' },
);

export default async function TermsPage() {
  const lang = await getLanguage();
  const t = (fa: string, en?: string) => serverT(lang, fa, en);
  const sections = [
    {
      title: t('نقش Ali Sales', 'The role of Ali Sales'),
      body: t(
        'Ali Sales فقط محل نمایش آگهی است. خرید و فروش و پرداخت بین خود کاربران انجام می‌شود و پلتفرم در معامله طرف حساب نیست.',
        'Ali Sales is a listings platform only. Buying, selling and payment happen directly between users; the platform is not a party to the transaction.',
      ),
    },
    {
      title: t('اطلاعات حساب', 'Account information'),
      body: t(
        'شماره موبایل فقط برای ورود و ارتباط بین خریدار و فروشنده استفاده می‌شود. شماره تماس فقط زمانی نمایش داده می‌شود که فروشنده اجازه داده باشد و آگهی فعال باشد.',
        'Your mobile number is used only for signing in and for contact between buyer and seller. A phone number is shown only when the seller has allowed it and the listing is active.',
      ),
    },
    {
      title: t('آمار آگهی', 'Listing statistics'),
      body: t(
        'بازدید هر کاربر یک بار شمرده می‌شود و هویت بازدیدکنندگان به مالک آگهی نمایش داده نمی‌شود.',
        'Each visitor is counted once, and visitor identities are never shown to the listing owner.',
      ),
    },
    {
      title: t('آگهی‌های نامناسب', 'Inappropriate listings'),
      body: t(
        'هر کاربر می‌تواند آگهی مشکوک را گزارش کند. گزارش‌ها بررسی می‌شوند و آگهی متخلف ممکن است پنهان شود.',
        'Any user can report a suspicious listing. Reports are reviewed and a listing that breaks the rules may be hidden.',
      ),
    },
  ];

  return (
    <article className="mx-auto max-w-3xl space-y-4 text-sm leading-7">
      <h1 className="text-xl font-extrabold">{t('قوانین و حریم خصوصی', 'Terms & privacy')}</h1>

      {sections.map((section) => (
        <section key={section.title} className="rounded-card border border-line bg-card p-4">
          <h2 className="font-extrabold">{section.title}</h2>
          <p className="mt-1 text-muted">{section.body}</p>
        </section>
      ))}
    </article>
  );
}
