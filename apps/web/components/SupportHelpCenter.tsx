'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
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
    titleFa: 'نحوه کارشناسی خودرو در تعمیرگاه شمس‌اله',
    titleEn: 'Inspection at Shamsollah Workshop',
    bodyFa: 'چه چیزهایی بررسی می‌شود و چطور نوبت بگیرید.',
    bodyEn: 'What gets checked and how to book a slot.',
    href: '/inspection',
    icon: 'gear',
    tone: 'bg-[#223382]/10 text-[#223382] dark:text-[#9BACD8]',
  },
  {
    titleFa: 'همکاری تبلیغاتی و درج بنر (همکاری با ما)',
    titleEn: 'Advertising and banner partnerships',
    bodyFa: 'برای نمایشگاه‌ها، تامین‌کنندگان قطعات و همکاران تجاری.',
    bodyEn: 'For showrooms, parts suppliers and commercial partners.',
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
    qFa: 'می‌تونم چند آگهی همزمان داشته باشم؟',
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
    qFa: 'کارشناسی خودرو اجباری است؟',
    qEn: 'Is an inspection mandatory?',
    aFa: 'اجباری نیست، اما برای خرید مطمئن توصیه می‌کنیم؛ کاربران سایت ۲۰٪ تخفیف دارند.',
    aEn: 'It is optional, but recommended; site members get 20% off.',
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
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const guides = useMemo(
    () =>
      GUIDES.filter((guide) =>
        `${guide.titleFa} ${guide.titleEn} ${guide.bodyFa} ${guide.bodyEn}`.toLowerCase().includes(q),
      ),
    [q],
  );
  const faqs = useMemo(
    () => FAQS.filter((faq) => `${faq.qFa} ${faq.qEn} ${faq.aFa} ${faq.aEn}`.toLowerCase().includes(q)),
    [q],
  );

  return (
    <section className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl bg-[#111144] px-4 py-7 text-white sm:px-7">
        <div className="absolute -end-10 -top-16 h-48 w-48 rounded-full bg-[#F98513]/30 blur-3xl" />
        <div className="relative">
          <p className="text-[11px] font-extrabold text-[#DEF434]">{t('مرکز راهنما', 'Help center')}</p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">{t('چطور می‌تونیم کمکت کنیم؟', 'How can we help?')}</h1>
          <p className="mt-2 max-w-xl text-sm leading-7 text-white/75">
            {t('دنبال پاسخ سؤالتون بگردید یا مستقیم با ما حرف بزنید؛ خوشحال می‌شیم کمک کنیم.', 'Search for an answer or talk to us directly. We are happy to help.')}
          </p>
          <label className="mt-4 flex max-w-xl items-center gap-2 rounded-full bg-white px-3 py-2.5 text-[#111144] shadow-lg" htmlFor="help-search">
            <Icon name="search" size={18} />
            <input
              id="help-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('جستجو در راهنماها و سوالات پرتکرار…', 'Search guides and FAQs...')}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </label>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-end justify-between gap-2">
          <h2 className="text-base font-extrabold text-ink">{t('راهنماهای کاربردی', 'Useful guides')}</h2>
          <span className="text-[10px] font-bold text-faint">{t(`${guides.length} راهنما`, `${guides.length} guides`)}</span>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {guides.map((guide) => (
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
          {guides.length === 0 && <p className="col-span-full py-5 text-center text-xs text-muted">{t('راهنمایی با این عبارت پیدا نشد.', 'No guide matched that search.')}</p>}
        </div>
      </div>

      <div className="rounded-card border border-line bg-card p-4 sm:p-5">
        <h2 className="text-base font-extrabold text-ink">{t('سوالات پرتکرار', 'Frequently asked')}</h2>
        <div className="mt-2 divide-y divide-line">
          {faqs.map((faq) => (
            <details key={faq.qFa} className="group py-2.5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-extrabold text-ink sm:text-sm">
                {lang === 'en' ? faq.qEn : faq.qFa}
                <Icon name="chevronDown" size={15} className="shrink-0 text-faint transition group-open:rotate-180" />
              </summary>
              <p className="mt-1.5 text-xs leading-6 text-muted">{lang === 'en' ? faq.aEn : faq.aFa}</p>
            </details>
          ))}
          {faqs.length === 0 && <p className="py-4 text-center text-xs text-muted">{t('سوالی با این عبارت پیدا نشد.', 'No FAQ matched that search.')}</p>}
        </div>
      </div>
    </section>
  );
}
