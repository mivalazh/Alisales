import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { InspectionOffer } from '@/components/InspectionOffer';

export const metadata: Metadata = {
  title: 'کارشناسی خودرو تعمیرگاه شمس‌اله',
  description:
    'کارشناسی فنی کامل موتور، گیربکس، بدنه و دیاگ تخصصی پیش از خرید در کیش — با ۲۰٪ تخفیف ویژه کاربران Ali Sales و صدور برگه ضمانت کارشناسی.',
};

const CHECKS = [
  'بررسی کامل موتور، گیربکس و سیستم تعلیق',
  'دیاگ تخصصی و خواندن خطاهای مخفی',
  'بررسی بدنه، رنگ و سابقه‌ی تصادف',
  'کنترل مدارک، پلاک و وضعیت گمرکی',
  'گزارش مکتوب با عکس و برآورد هزینه‌ی تعمیر',
  'صدور برگه ضمانت کارشناسی برای خرید مطمئن',
];

/**
 * Dedicated workshop landing page — the public face of «تعمیرگاه تخصصی
 * شمس‌اله» inside Ali Sales, and the same booking flow a listing shows.
 */
export default function InspectionPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="rounded-card border border-line bg-card p-5">
        <p className="flex items-center gap-2 text-xs font-extrabold text-cta">
          <Icon name="shieldCheck" size={16} />
          Ali Sales؛ زیرمجموعه رسمی تعمیرگاه تخصصی شمس‌اله
        </p>
        <h1 className="mt-2 text-xl font-extrabold sm:text-2xl">
          کارشناسی فنی خودرو پیش از خرید در کیش
        </h1>
        <p className="mt-2 text-sm leading-7 text-muted">
          پیش از پرداخت پول، خودرو را کارشناسان تعمیرگاه شمس‌اله بررسی می‌کنند؛ همان
          کارگاهی که آگهی‌های «کارشناسی‌شده» را تأیید می‌کند.
        </p>
        <ul className="mt-4 grid gap-2 text-xs font-semibold text-ink sm:grid-cols-2">
          {CHECKS.map((item) => (
            <li key={item} className="flex items-start gap-2 rounded-field bg-page px-3 py-2">
              <Icon name="check" size={15} className="mt-0.5 shrink-0 text-ok" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <InspectionOffer />

      <section className="rounded-card border border-line bg-card p-5 text-sm leading-7">
        <h2 className="text-base font-extrabold">چرا کارشناسی تعمیرگاه شمس‌اله؟</h2>
        <p className="mt-2 text-muted">
          بازار خودروی کیش پر از خودروهای وارداتی است که سابقه‌ی واقعی‌شان فقط با
          دستگاه دیاگ و چشم کارشناس مشخص می‌شود. گزارش ما پیش از خرید می‌گوید چه
          چیزی سالم است، چه چیزی هزینه‌ی تعمیر دارد و قیمت منصفانه‌ی خودرو چقدر است.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/cars" className="btn-ghost text-sm">
            دیدن آگهی‌های کارشناسی‌شده
          </Link>
          <Link href="/support" className="btn-ghost text-sm">
            تماس با پشتیبانی Ali Sales
          </Link>
        </div>
      </section>
    </div>
  );
}
