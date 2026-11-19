'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { Icon, type IconName } from './Icon';

const GUIDES: ReadonlyArray<{
  titleFa: string;
  titleEn: string;
  href: string;
  icon: IconName;
  tone: string;
}> = [
  {
    titleFa: 'خرید و فروش امن در کیش',
    titleEn: 'Safe buying and selling in Kish',
    href: '/guide',
    icon: 'shieldCheck',
    tone: 'bg-[#F98513]/12 text-[#F98513]',
  },
  {
    titleFa: 'ثبت آگهی در چند دقیقه',
    titleEn: 'Post a listing in minutes',
    href: '/new',
    icon: 'camera',
    tone: 'bg-[#223382]/10 text-[#223382] dark:text-[#9BACD8]',
  },
  {
    titleFa: 'پلاک کیش، گذر موقت و مدارک',
    titleEn: 'Kish plates, temporary transit and paperwork',
    href: '/terms',
    icon: 'plate',
    tone: 'bg-[#0F7FC4]/12 text-[#0F7FC4]',
  },
  {
    titleFa: 'پیگیری تیکت و گزارش آگهی مشکوک',
    titleEn: 'Ticket tracking and reporting a listing',
    href: '/support#ticket',
    icon: 'message',
    tone: 'bg-[#DEF434]/25 text-[#111144] dark:text-[#DEF434]',
  },
];

/**
 * «راهنمای کاربردی» — four square guide cards.
 *
 * Phones get a 2×2 grid so the whole set fits one screen-height instead of a
 * vertical list; from `sm` up the same squares become one row of four. Each
 * card keeps only its icon, title and «خواندن راهنما» link, which is what fits
 * a square at 375px.
 */
export function SupportHelpCenter() {
  const { t, lang } = useI18n();

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-extrabold text-ink sm:text-xl">
        {t('راهنمای کاربردی', 'Practical guides')}
      </h2>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {GUIDES.map((guide) => (
          <Link
            key={guide.titleFa}
            href={guide.href}
            className="group flex aspect-square flex-col justify-between rounded-2xl border border-line bg-card p-3 transition hover:border-line-strong hover:shadow-sm sm:p-4"
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${guide.tone}`}>
              <Icon name={guide.icon} size={16} />
            </span>
            <p className="mt-2 line-clamp-3 text-xs font-extrabold leading-5 text-ink sm:text-sm sm:leading-6">
              {lang === 'en' ? guide.titleEn : guide.titleFa}
            </p>
            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-extrabold text-cta sm:text-[11px]">
              {t('خواندن راهنما', 'Read guide')} <Icon name="arrowLeft" size={12} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
