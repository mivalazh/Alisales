import { localizedMetadata } from '@/lib/i18n/metadata';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/Icon';
import { getLanguage, serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'درباره‌ی ما' },
  { title: 'About us' },
);

const PILLS: ReadonlyArray<{ fa: string; en: string; icon: IconName }> = [
  { fa: 'خودروهای لوکس', en: 'Luxury cars', icon: 'car' },
  { fa: 'اسکوتر و موتور برقی', en: 'Electric scooters & bikes', icon: 'sparkle' },
  { fa: 'قطعات اورجینال', en: 'Original spare parts', icon: 'gear' },
];

export default async function AboutPage() {
  const lang = await getLanguage();
  const t = (fa: string, en: string) => serverT(lang, fa, en);

  return (
    <article className="mx-auto max-w-3xl">
      <section className="relative overflow-hidden rounded-3xl bg-[#111144] px-5 py-8 text-white shadow-xl sm:px-8 sm:py-10">
        <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_12%_16%,#F98513_0,transparent_30%),radial-gradient(circle_at_88%_82%,#DEF434_0,transparent_25%)]" />
        <div className="relative">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-white/85 backdrop-blur">
            <Icon name="pin" size={13} />
            {t('کیش، ایران', 'Kish Island, Iran')}
          </p>

          <h1 className="mt-4 max-w-2xl text-2xl font-black leading-tight sm:text-4xl">
            {t(
              'مرجع خودرو، موتور برقی و قطعات کیش.',
              'Kish Island’s home for cars, electric scooters and spare parts.',
            )}
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-7 text-white/80 sm:text-base sm:leading-8">
            {t(
              'علی سیلز بازار خودروهای لوکس، اسکوترهای برقی، ماشین‌آلات سنگین و قطعات اورجینال را در یک جای روشن و قابل‌اعتماد جمع کرده است. آگهی‌ها را ببینید، مقایسه کنید و مستقیم با فروشنده حرف بزنید.',
              'Ali Sales brings luxury cars, electric scooters, heavy machinery and original spare parts into one clear, trusted marketplace. Browse, compare and talk directly to the seller.',
            )}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {PILLS.map((pill) => (
              <span
                key={pill.fa}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white backdrop-blur"
              >
                <Icon name={pill.icon} size={14} className="text-[#DEF434]" />
                {t(pill.fa, pill.en)}
              </span>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/cars"
              className="rounded-xl bg-[#F98513] px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#e0760c]"
            >
              {t('دیدن خودروها', 'Browse cars')}
            </Link>
            <Link
              href="/parts"
              className="rounded-xl border border-white/25 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
            >
              {t('قطعات و لوازم یدکی', 'Spare parts')}
            </Link>
          </div>
        </div>
      </section>
    </article>
  );
}
