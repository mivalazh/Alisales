import { localizedMetadata } from '@/lib/i18n/metadata';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { InspectionOffer } from '@/components/InspectionOffer';
import { getLanguage, serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'کارشناسی خودرو تعمیرگاه شمس‌اله', description: 'کارشناسی فنی کامل موتور، گیربکس، بدنه و دیاگ تخصصی پیش از خرید در کیش — با ۲۰٪ تخفیف ویژه کاربران Ali Sales و صدور برگه ضمانت کارشناسی.' },
  { title: 'Shamsollah Workshop Vehicle Inspection', description: 'A full pre-purchase mechanical, gearbox, body and diagnostics inspection in Kish — 20% off for Ali Sales users, with a written inspection guarantee.' },
);

export default async function InspectionPage() {
  const lang = await getLanguage();
  const t = (fa: string, en: string) => serverT(lang, fa, en);
  const checks = [
    t('بررسی کامل موتور، گیربکس و سیستم تعلیق', 'Full engine, gearbox and suspension inspection'),
    t('دیاگ تخصصی و خواندن خطاهای مخفی', 'Specialist diagnostics that surface hidden fault codes'),
    t('بررسی بدنه، رنگ و سابقه‌ی تصادف', 'Body, paint and accident-history checks'),
    t('کنترل مدارک، پلاک و وضعیت گمرکی', 'Documents, plate and customs-status verification'),
    t('گزارش مکتوب با عکس و برآورد هزینه‌ی تعمیر', 'A written report with photos and a repair-cost estimate'),
    t('صدور برگه ضمانت کارشناسی برای خرید مطمئن', 'An inspection warranty sheet for a confident purchase'),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="rounded-card border border-line bg-card p-5">
        <p className="flex items-center gap-2 text-xs font-extrabold text-cta">
          <Icon name="shieldCheck" size={16} />
          {t(
            'Ali Sales؛ زیرمجموعه رسمی تعمیرگاه تخصصی شمس‌اله',
            'Ali Sales is the official subsidiary of Shamsollah Specialist Workshop',
          )}
        </p>
        <h1 className="mt-2 text-xl font-extrabold sm:text-2xl">
          {t(
            'کارشناسی فنی خودرو پیش از خرید در کیش',
            'Pre-purchase vehicle inspections in Kish',
          )}
        </h1>
        <p className="mt-2 text-sm leading-7 text-muted">
          {t(
            'پیش از پرداخت پول، خودرو را کارشناسان تعمیرگاه شمس‌اله بررسی می‌کنند؛ همان کارگاهی که آگهی‌های «کارشناسی‌شده» را تأیید می‌کند.',
            'Before you pay, Shamsollah Workshop’s specialists inspect the vehicle — the same workshop that certifies our inspected listings.',
          )}
        </p>
        <ul className="mt-4 grid gap-2 text-xs font-semibold text-ink sm:grid-cols-2">
          {checks.map((item) => (
            <li key={item} className="flex items-start gap-2 rounded-field bg-page px-3 py-2">
              <Icon name="check" size={15} className="mt-0.5 shrink-0 text-ok" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <InspectionOffer />

      <section className="rounded-card border border-line bg-card p-5 text-sm leading-7">
        <h2 className="text-base font-extrabold">
          {t('چرا کارشناسی تعمیرگاه شمس‌اله؟', 'Why a Shamsollah inspection?')}
        </h2>
        <p className="mt-2 text-muted">
          {t(
            'بازار خودروی کیش پر از خودروهای وارداتی است که سابقه‌ی واقعی‌شان فقط با دستگاه دیاگ و چشم کارشناس مشخص می‌شود. گزارش ما پیش از خرید می‌گوید چه چیزی سالم است، چه چیزی هزینه‌ی تعمیر دارد و قیمت منصفانه‌ی خودرو چقدر است.',
            'Kish’s vehicle market is full of imports whose real history only shows up through diagnostic equipment and an expert’s eyes. Our pre-purchase report tells you what is sound, what will need repair, and what a fair price looks like.',
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/cars" className="btn-ghost text-sm">
            {t('دیدن آگهی‌های کارشناسی‌شده', 'Browse inspected listings')}
          </Link>
          <Link href="/support" className="btn-ghost text-sm">
            {t('تماس با پشتیبانی Ali Sales', 'Contact Ali Sales support')}
          </Link>
        </div>
      </section>
    </div>
  );
}
