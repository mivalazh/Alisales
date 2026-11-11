import { localizedMetadata } from '@/lib/i18n/metadata';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { InspectionOffer } from '@/components/InspectionOffer';
import { getLanguage, serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  {
    title: 'کارشناسی خودرو تعمیرگاه شمس‌اله',
    description:
      'کارشناسی فنی کامل موتور، گیربکس، بدنه و دیاگ تخصصی پیش از خرید در کیش — با ۲۰٪ تخفیف ویژه کاربران Ali Sales و صدور برگه ضمانت کارشناسی.',
  },
  {
    title: 'Shamsollah Workshop Vehicle Inspection',
    description:
      'A full pre-purchase mechanical, gearbox, body and diagnostics inspection in Kish — 20% off for Ali Sales users, with a written inspection guarantee.',
  },
);

const STEPS = [
  {
    fa: 'رزرو نوبت',
    en: 'Book a slot',
    bodyFa: 'زمان بازدید را انتخاب کنید؛ کارشناس برای تأیید تماس می‌گیرد.',
    bodyEn: 'Choose a time; the workshop calls to confirm it.',
    icon: 'clock' as const,
  },
  {
    fa: 'بازرسی حضوری',
    en: 'On-site inspection',
    bodyFa: 'موتور، گیربکس، بدنه و شاسی با دستگاه و چشم کارشناس بررسی می‌شود.',
    bodyEn: 'Engine, gearbox, body and chassis are checked with diagnostics and an expert eye.',
    icon: 'gear' as const,
  },
  {
    fa: 'گزارش مکتوب',
    en: 'Written report',
    bodyFa: 'عکس، برآورد هزینه تعمیر و نکات مذاکره در گزارش می‌آید.',
    bodyEn: 'Photos, repair estimates and negotiation points arrive in one report.',
    icon: 'badgeCheck' as const,
  },
  {
    fa: 'خرید مطمئن',
    en: 'Buy with confidence',
    bodyFa: 'با برگه ضمانت کارشناسی و قیمت منصفانه تصمیم بگیرید.',
    bodyEn: 'Decide with an inspection warranty sheet and a fair price.',
    icon: 'shieldCheck' as const,
  },
];

const CHECKS = [
  ['بررسی کامل موتور، گیربکس و سیستم تعلیق', 'Full engine, gearbox and suspension inspection'],
  ['دیاگ تخصصی و خواندن خطاهای مخفی', 'Specialist diagnostics that surface hidden fault codes'],
  ['بررسی بدنه، رنگ و سابقه‌ی تصادف', 'Body, paint and accident-history checks'],
  ['کنترل مدارک، پلاک و وضعیت گمرکی', 'Documents, plate and customs-status verification'],
  ['گزارش مکتوب با عکس و برآورد هزینه‌ی تعمیر', 'A written report with photos and a repair-cost estimate'],
  ['صدور برگه ضمانت کارشناسی برای خرید مطمئن', 'An inspection warranty sheet for a confident purchase'],
] as const;

export default async function InspectionPage() {
  const lang = await getLanguage();
  const t = (fa: string, en: string) => serverT(lang, fa, en);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="rounded-3xl border border-line bg-[#111144] px-5 py-7 text-white shadow-lg sm:px-8 sm:py-9">
        <p className="flex items-center gap-2 text-[11px] font-extrabold text-[#DEF434]">
          <Icon name="shieldCheck" size={16} />
          {t(
            'زیرمجموعه رسمی تعمیرگاه تخصصی شمس‌اله',
            'Official subsidiary of Shamsollah Specialist Workshop',
          )}
        </p>
        <h1 className="mt-3 max-w-2xl text-2xl font-black leading-tight sm:text-4xl">
          {t('کارشناسی فنی خودرو پیش از خرید در کیش', 'Pre-purchase vehicle inspections in Kish')}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/80">
          {t(
            'همان کارگاهی که آگهی‌های کارشناسی‌شده را تأیید می‌کند، پیش از پرداخت پول خودرو را برای شما بررسی می‌کند.',
            'The workshop that certifies inspected listings checks the car for you before you pay.',
          )}
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-start">
        <div className="space-y-4">
          <section className="rounded-card border border-line bg-card p-4 sm:p-5">
            <h2 className="text-base font-extrabold text-ink">{t('چهار قدم تا خرید مطمئن', 'Four steps to a confident purchase')}</h2>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {STEPS.map((step, index) => (
                <div key={step.fa} className="rounded-2xl border border-line bg-page/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F98513]/15 text-[#F98513]">
                      <Icon name={step.icon} size={16} />
                    </span>
                    <span className="text-[10px] font-black text-faint">0{index + 1}</span>
                  </div>
                  <p className="mt-2 text-xs font-extrabold text-ink">{t(step.fa, step.en)}</p>
                  <p className="mt-1 text-[10px] leading-5 text-muted">{t(step.bodyFa, step.bodyEn)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-card border border-line bg-card p-4 sm:p-5">
            <h2 className="text-base font-extrabold text-ink">{t('چک‌لیست شش‌گانه بازرسی', 'Six-point inspection checklist')}</h2>
            <ul className="mt-3 grid gap-2">
              {CHECKS.map(([fa, en]) => (
                <li key={fa} className="flex items-start gap-2 rounded-field bg-page px-3 py-2 text-xs font-semibold text-ink">
                  <Icon name="check" size={15} className="mt-0.5 shrink-0 text-ok" />
                  {t(fa, en)}
                </li>
              ))}
            </ul>
          </section>

          <div className="flex flex-wrap gap-2">
            <Link href="/cars" className="btn-ghost text-sm">
              {t('دیدن آگهی‌های کارشناسی‌شده', 'Browse inspected listings')}
            </Link>
            <Link href="/support" className="btn-ghost text-sm">
              {t('تماس با پشتیبانی', 'Contact support')}
            </Link>
          </div>
        </div>

        <div className="lg:sticky lg:top-24">
          <InspectionOffer />
          <p className="mt-2 px-1 text-[10px] leading-5 text-faint">
            {t(
              'نوبت‌دهی آنلاین است؛ پرداخت پس از تأیید زمان و در تعمیرگاه انجام می‌شود.',
              'Book online; payment happens after time confirmation at the workshop.',
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
