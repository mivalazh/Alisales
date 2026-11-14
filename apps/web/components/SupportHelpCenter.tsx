'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { Icon, type IconName } from './Icon';

const GUIDES: ReadonlyArray<{
  titleFa: string;
  titleEn: string;
  bodyFa: string;
  bodyEn: string;
  href: string;
  icon: IconName;
  tone: string;
}> = [
  {
    titleFa: 'خرید و فروش امن در کیش',
    titleEn: 'Safe buying and selling in Kish',
    bodyFa: 'خودرو را از نزدیک ببینید، شاسی و مدارک را تطبیق دهید و معامله را داخل سایت هماهنگ کنید.',
    bodyEn: 'See the car in person, match the chassis and documents, and keep the deal coordinated on the site.',
    href: '/guide',
    icon: 'shieldCheck',
    tone: 'bg-[#F98513]/12 text-[#F98513]',
  },
  {
    titleFa: 'ثبت آگهی در چند دقیقه',
    titleEn: 'Post a listing in minutes',
    bodyFa: 'عکس‌ها را اضافه کنید و مشخصات را کامل کنید؛ آگهی بلافاصله منتشر می‌شود و در دوره راه‌اندازی رایگان است.',
    bodyEn: 'Add photos and complete the specs; your listing goes live immediately and is free during launch.',
    href: '/new',
    icon: 'camera',
    tone: 'bg-[#223382]/10 text-[#223382] dark:text-[#9BACD8]',
  },
  {
    titleFa: 'پلاک کیش، گذر موقت و مدارک',
    titleEn: 'Kish plates, temporary transit and paperwork',
    bodyFa: 'وضعیت پلاک را پیش از پرداخت بررسی کنید؛ پلاک کیش، گذر موقت و بدون پلاک مدارک متفاوتی دارند.',
    bodyEn: 'Check the plate status before paying; Kish, temporary-transit and unplated vehicles need different paperwork.',
    href: '/terms',
    icon: 'plate',
    tone: 'bg-[#0F7FC4]/12 text-[#0F7FC4]',
  },
  {
    titleFa: 'پیگیری تیکت و گزارش آگهی مشکوک',
    titleEn: 'Ticket tracking and reporting a listing',
    bodyFa: 'پاسخ تیکت را از دکمه «مشاهده تیکت‌ها» ببینید؛ برای آگهی مشکوک از دکمه «گزارش آگهی» همان صفحه استفاده کنید.',
    bodyEn: 'Read replies from View my tickets; for a suspicious listing use Report listing on that page.',
    href: '/support#ticket',
    icon: 'message',
    tone: 'bg-[#DEF434]/25 text-[#111144] dark:text-[#DEF434]',
  },
];

export function SupportHelpCenter() {
  const { t, lang } = useI18n();

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-extrabold text-cta">{t('مرکز راهنما', 'Help center')}</p>
          <h2 className="mt-1 text-lg font-extrabold text-ink sm:text-xl">
            {t('راهنمای کاربردی', 'Practical guides')}
          </h2>
        </div>
        <p className="max-w-sm text-xs leading-6 text-muted">
          {t(
            'پاسخ‌های ضروری برای خرید، فروش و استفاده از سایت — بدون تکرار.',
            'The essential answers for buying, selling and using the site — without repetition.',
          )}
        </p>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {GUIDES.map((guide) => (
          <Link
            key={guide.titleFa}
            href={guide.href}
            className="group rounded-2xl border border-line bg-card p-4 transition hover:border-line-strong hover:shadow-sm"
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${guide.tone}`}>
              <Icon name={guide.icon} size={18} />
            </span>
            <p className="mt-2.5 text-sm font-extrabold text-ink">
              {lang === 'en' ? guide.titleEn : guide.titleFa}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-muted">
              {lang === 'en' ? guide.bodyEn : guide.bodyFa}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-extrabold text-cta">
              {t('خواندن راهنما', 'Read guide')} <Icon name="arrowLeft" size={12} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
