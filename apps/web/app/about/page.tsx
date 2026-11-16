import { localizedMetadata } from '@/lib/i18n/metadata';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/Icon';
import { getLanguage, serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'درباره‌ی ما' },
  { title: 'About us' },
);

const CATEGORIES: ReadonlyArray<{
  href: string;
  titleFa: string;
  titleEn: string;
  detailFa: string;
  detailEn: string;
  icon: IconName;
}> = [
  {
    href: '/cars',
    titleFa: 'خودروها',
    titleEn: 'Cars',
    detailFa: 'لوکس، گذر موقت و پلاک منطقه آزاد کیش',
    detailEn: 'Luxury cars, temporary transit and Kish free-zone plates',
    icon: 'car',
  },
  {
    href: '/motorcycles',
    titleFa: 'موتور و اسکوتر برقی',
    titleEn: 'Bikes & electric scooters',
    detailFa: 'مخصوص تردد شهری و تفریحی جزیره',
    detailEn: 'Built for island commuting and leisure',
    icon: 'sparkle',
  },
  {
    href: '/heavy',
    titleFa: 'ماشین‌آلات سنگین',
    titleEn: 'Heavy machinery',
    detailFa: 'راه‌سازی، تجاری و پروژه‌ای',
    detailEn: 'Road-building, commercial and project machinery',
    icon: 'gear',
  },
  {
    href: '/parts',
    titleFa: 'قطعات و لوازم یدکی',
    titleEn: 'Spare parts & accessories',
    detailFa: 'اورجینال، استوک و کمیاب',
    detailEn: 'Original, stock and rare parts',
    icon: 'shieldCheck',
  },
];

export default async function AboutPage() {
  const lang = await getLanguage();
  const t = (fa: string, en: string) => serverT(lang, fa, en);

  return (
    <article className="mx-auto w-full max-w-5xl">
      <section className="relative overflow-hidden rounded-3xl bg-[#111144] px-5 py-8 text-white shadow-xl sm:px-8 sm:py-10">
        <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_12%_16%,#F98513_0,transparent_30%),radial-gradient(circle_at_88%_82%,#DEF434_0,transparent_25%)]" />
        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-white/85 backdrop-blur">
              <Icon name="pin" size={13} />
              {t(
                'پلتفرم تخصصی آگهی و معرفی در جزیره کیش',
                'Specialist listing and showcase platform in Kish Island',
              )}
            </p>

            <h1 className="mt-4 max-w-2xl text-2xl font-black leading-tight sm:text-4xl">
              {t(
                'ویترین اول خودرو، موتور برقی، ماشین‌آلات سنگین و قطعات در کیش.',
                'Kish’s first showcase for cars, electric bikes, heavy machinery and parts.',
              )}
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-7 text-white/80 sm:text-base sm:leading-8">
              {t(
                'علی سیلز (Ali Sales) مرجع تخصصی ثبت آگهی و ارتباط مستقیم خریداران و فروشندگان در منطقه آزاد کیش است. ما واسطه‌ها را حذف کرده‌ایم تا بهترین آگهی‌های جزیره را با قیمت شفاف (تومان و درهم) ببینید، مقایسه کنید و بی‌واسطه با صاحب آگهی معامله کنید.',
                'Ali Sales is Kish Free Zone’s specialist marketplace for listing ads and connecting buyers and sellers directly. We have removed the middlemen so you can see the island’s best listings with transparent pricing in Toman and AED, compare them, and deal directly with the owner.',
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
            <p className="text-[11px] font-extrabold text-[#DEF434]">
              {t('۴ بخش تخصصی پلتفرم', '4 specialist platform sections')}
            </p>
            <div className="mt-3 space-y-2">
              {CATEGORIES.map((category) => (
                <Link
                  key={category.href}
                  href={category.href}
                  className="group flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-white transition hover:border-[#DEF434]/70 hover:bg-white/[0.16]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[#DEF434]">
                    <Icon name={category.icon} size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-extrabold">
                      {t(category.titleFa, category.titleEn)}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-4 text-white/65">
                      {t(category.detailFa, category.detailEn)}
                    </span>
                  </span>
                  <Icon
                    name="chevronLeft"
                    size={14}
                    className="shrink-0 text-white/45 transition group-hover:text-[#DEF434]"
                  />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}
