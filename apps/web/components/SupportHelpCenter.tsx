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
    titleFa: 'راهنمای خرید و فروش امن در کیش',
    titleEn: 'Safe buying and selling in Kish',
    bodyFa: 'از دیدن خودرو تا بستن قرارداد، قدم‌به‌قدم با خیال راحت.',
    bodyEn: 'From viewing the car to closing the deal with confidence.',
    href: '/guide',
    icon: 'shieldCheck',
    tone: 'bg-[#F98513]/12 text-[#F98513]',
  },
  {
    titleFa: 'قوانین پلاک منطقه آزاد و گذر موقت',
    titleEn: 'Free-zone plates and temporary transit',
    bodyFa: 'تفاوت پلاک کیش، گذر موقت و مدارک لازم را ساده توضیح داده‌ایم.',
    bodyEn: 'Kish plates, temporary transit and the paperwork, explained simply.',
    href: '/terms',
    icon: 'plate',
    tone: 'bg-[#0F7FC4]/12 text-[#0F7FC4]',
  },
  {
    titleFa: 'راهنمای ثبت آگهی و عکس‌های بهتر',
    titleEn: 'Posting guide and better photos',
    bodyFa: 'چطور آگهی کامل‌تری بسازید و زودتر دیده شوید.',
    bodyEn: 'How to build a complete listing and get seen sooner.',
    href: '/guide',
    icon: 'camera',
    tone: 'bg-[#223382]/10 text-[#223382] dark:text-[#9BACD8]',
  },
  {
    titleFa: 'همکاری تبلیغاتی و درج بنر',
    titleEn: 'Advertising and banner partnerships',
    bodyFa: 'برای نمایشگاه‌ها، فروشگاه‌های قطعات و همکاران تجاری.',
    bodyEn: 'For showrooms, parts stores and commercial partners.',
    href: '/support/ticket?topic=advertising',
    icon: 'badgeCheck',
    tone: 'bg-[#DEF434]/25 text-[#111144] dark:text-[#DEF434]',
  },
];

const FAQS: ReadonlyArray<{ qFa: string; qEn: string; aFa: string; aEn: string }> = [
  {
    qFa: 'ثبت آگهی چقدر زمان می‌برد؟',
    qEn: 'How long does posting take?',
    aFa: 'چند دقیقه! عکس‌ها را اضافه کنید، مشخصات را کامل کنید و آگهی بلافاصله منتشر می‌شود.',
    aEn: 'A few minutes: add photos, fill the specs and your ad goes live immediately.',
  },
  {
    qFa: 'می‌توانم چند آگهی همزمان داشته باشم؟',
    qEn: 'Can I have several ads at once?',
    aFa: 'بله، در دوره راه‌اندازی ثبت و انتشار آگهی‌ها رایگان و بدون محدودیت است.',
    aEn: 'Yes. During launch, posting and publishing are free without a listing cap.',
  },
  {
    qFa: 'قیمت درهم چطور محاسبه می‌شود؟',
    qEn: 'How is the AED price calculated?',
    aFa: 'نرخ روز درهم از بازار آزاد خوانده می‌شود و کنار قیمت تومان نمایش داده می‌شود.',
    aEn: 'The live free-market AED rate is shown next to every Toman price.',
  },
  {
    qFa: 'اگر آگهی مشکوکی دیدم چه کنم؟',
    qEn: 'What if a listing looks suspicious?',
    aFa: 'از دکمه «گزارش آگهی» همان صفحه استفاده کنید؛ تیم ما سریع بررسی می‌کند.',
    aEn: 'Use Report listing on that page; our team reviews it quickly.',
  },
  {
    qFa: 'کارشناسی پیش از خرید چطور رزرو می‌شود؟',
    qEn: 'How do I book a pre-purchase inspection?',
    aFa: 'از صفحه هر آگهی، دکمه رزرو کارشناسی را بزنید و تاریخ و ساعت را انتخاب کنید.',
    aEn: 'On any listing page, tap Book inspection and choose a date and time.',
  },
  {
    qFa: 'چطور از پاسخ تیکتم باخبر شوم؟',
    qEn: 'How will I know my ticket was answered?',
    aFa: 'همین‌جا در «تیکت‌های من» و همچنین با اعلان زنگ بالای سایت.',
    aEn: 'In My tickets here, and through the bell notification in the header.',
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
            {t('راهنمای کاربردی و سوالات متداول', 'Practical guides and FAQs')}
          </h2>
        </div>
        <p className="max-w-sm text-xs leading-6 text-muted">
          {t(
            'پاسخ‌های کوتاه و راهنماهای کاربردی برای خرید، فروش و استفاده از سایت.',
            'Short answers and practical guides for buying, selling and using the site.',
          )}
        </p>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {GUIDES.map((guide) => (
          <Link key={guide.titleFa} href={guide.href} className="group rounded-2xl border border-line bg-card p-4 transition hover:border-line-strong hover:shadow-sm">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${guide.tone}`}>
              <Icon name={guide.icon} size={18} />
            </span>
            <p className="mt-2.5 text-sm font-extrabold text-ink">{lang === 'en' ? guide.titleEn : guide.titleFa}</p>
            <p className="mt-1 text-[11px] leading-5 text-muted">{lang === 'en' ? guide.bodyEn : guide.bodyFa}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-extrabold text-cta">
              {t('خواندن راهنما', 'Read guide')} <Icon name="arrowLeft" size={12} />
            </span>
          </Link>
        ))}
      </div>

      <div className="rounded-card border border-line bg-card p-4 sm:p-5">
        <h2 className="text-base font-extrabold text-ink">{t('سوالات متداول', 'Frequently asked')}</h2>
        <div className="mt-2 divide-y divide-line">
          {FAQS.map((faq) => (
            <details key={faq.qFa} className="group py-2.5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-extrabold text-ink sm:text-sm">
                {lang === 'en' ? faq.qEn : faq.qFa}
                <Icon name="chevronDown" size={15} className="shrink-0 text-faint transition group-open:rotate-180" />
              </summary>
              <p className="mt-1.5 text-xs leading-6 text-muted">{lang === 'en' ? faq.aEn : faq.aFa}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
