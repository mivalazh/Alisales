import { localizedMetadata } from '@/lib/i18n/metadata';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/Icon';
import { getLanguage, serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'درباره‌ی ما' },
  { title: 'About us' },
);

const VALUES: ReadonlyArray<{
  fa: string;
  en: string;
  bodyFa: string;
  bodyEn: string;
  icon: IconName;
}> = [
  {
    fa: 'شفافیت قیمت درهم و تومان',
    en: 'Transparent Toman and AED pricing',
    bodyFa: 'هر قیمت با نرخ روز درهم و تومان دیده می‌شود؛ عددی پنهان نمی‌ماند.',
    bodyEn: 'Every price shows the live Toman and AED reference, with no hidden number.',
    icon: 'badgeCheck',
  },
  {
    fa: 'اصالت و کارشناسی فنی',
    en: 'Authenticity and technical inspection',
    bodyFa: 'کارشناسی تعمیرگاه شمس‌اله، رنگ، شاسی و مدارک را پیش از خرید روشن می‌کند.',
    bodyEn: 'Shamsollah workshop inspection makes paint, chassis and documents clear before purchase.',
    icon: 'shieldCheck',
  },
  {
    fa: 'سرعت و امنیت معامله',
    en: 'Fast, safe transactions',
    bodyFa: 'چت داخلی، گزارش تخلف و اطلاعات تماس کنترل‌شده، معامله را ساده‌تر می‌کند.',
    bodyEn: 'In-app chat, abuse reporting and controlled contact details keep the deal simple.',
    icon: 'clock',
  },
  {
    fa: 'پشتیبانی تخصصی تعمیرگاه شمس‌اله',
    en: 'Shamsollah workshop expertise',
    bodyFa: 'پشت Ali Sales یک تعمیرگاه واقعی در کیش است، نه فقط یک فهرست آگهی.',
    bodyEn: 'Ali Sales is backed by a real Kish workshop, not just a listing board.',
    icon: 'gear',
  },
];

export default async function AboutPage() {
  const lang = await getLanguage();
  const t = (fa: string, en: string) => serverT(lang, fa, en);

  return (
    <article className="mx-auto max-w-4xl space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-[#111144] px-5 py-8 text-white shadow-lg sm:px-8 sm:py-10">
        <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_15%_20%,#F98513_0,transparent_28%),radial-gradient(circle_at_88%_75%,#DEF434_0,transparent_24%)]" />
        <div className="relative max-w-2xl">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-white/85 backdrop-blur">
            <Icon name="sparkle" size={14} />
            {t('داستان ما در جزیره کیش', 'Our story on Kish Island')}
          </p>
          <h1 className="mt-4 text-2xl font-black leading-tight sm:text-4xl">
            {t(
              'خرید و فروش خودرو، با شفافیت و کارشناسی واقعی',
              'Buying and selling cars with real transparency and inspection',
            )}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-white/80 sm:text-base sm:leading-8">
            {t(
              'Ali Sales از دل تعمیرگاه تخصصی شمس‌اله در کیش شکل گرفت؛ جایی که هر خودرو پیش از معامله از نزدیک دیده می‌شود. حالا همان تجربه، فهرست خودرو و قطعات کیش را قابل اعتمادتر می‌کند.',
              'Ali Sales grew out of Shamsollah Specialist Workshop in Kish, where every car is seen up close before a deal. That same experience now makes Kish’s vehicle and parts marketplace more trustworthy.',
            )}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/cars" className="rounded-full bg-[#DEF434] px-4 py-2 text-sm font-extrabold text-[#111144] transition hover:bg-white">
              {t('دیدن خودروها', 'Browse vehicles')}
            </Link>
            <Link href="/inspection" className="rounded-full border border-white/25 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10">
              {t('کارشناسی پیش از خرید', 'Pre-purchase inspection')}
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-card border border-line bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-extrabold text-cta">{t('هویت ما', 'Our identity')}</p>
            <h2 className="mt-1 text-lg font-extrabold text-ink sm:text-xl">
              {t('چهار چیزی که هر روز تکرار می‌کنیم', 'Four things we repeat every day')}
            </h2>
          </div>
          <p className="max-w-sm text-xs leading-6 text-muted">
            {t(
              'این ارزش‌ها فقط شعار نیستند؛ در قیمت‌گذاری، گزارش فنی و پشتیبانی هر آگهی دیده می‌شوند.',
              'These are not slogans; they show up in pricing, inspection reports and support on every listing.',
            )}
          </p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {VALUES.map((value) => (
            <div key={value.fa} className="rounded-2xl border border-line bg-page/70 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F98513]/15 text-[#F98513]">
                <Icon name={value.icon} size={19} />
              </span>
              <h3 className="mt-3 text-sm font-extrabold text-ink">{t(value.fa, value.en)}</h3>
              <p className="mt-1 text-xs leading-6 text-muted">{t(value.bodyFa, value.bodyEn)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="-mt-2 grid gap-3 sm:grid-cols-2 sm:-mt-5 sm:px-4">
        <div className="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-5">
          <p className="text-[11px] font-extrabold text-cta">{t('چشم‌انداز', 'Vision')}</p>
          <p className="mt-2 text-sm font-bold leading-7 text-ink">
            {t(
              'مرجع اول خرید و فروش خودرو، موتور و قطعات در کیش باشیم؛ با اطلاعاتی که خریدار می‌تواند به آن تکیه کند.',
              'To be the first reference for buying and selling cars, bikes and parts in Kish, with information buyers can rely on.',
            )}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-5">
          <p className="text-[11px] font-extrabold text-cta">{t('ماموریت ما', 'Our mission')}</p>
          <p className="mt-2 text-sm font-bold leading-7 text-ink">
            {t(
              'فاصله بین فروشنده و خریدار را با قیمت روشن، کارشناسی فنی و ارتباط مستقیم کمتر کنیم.',
              'To shorten the distance between seller and buyer with clear prices, technical inspection and direct communication.',
            )}
          </p>
        </div>
      </section>
    </article>
  );
}
