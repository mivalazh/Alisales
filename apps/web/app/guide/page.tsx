import { localizedMetadata } from '@/lib/i18n/metadata';
import Link from 'next/link';
import { FREE_LISTING_LIMIT, formatAmountLatin } from '@alisales/schemas';
import { getLanguage } from '@/lib/i18n/server';
import { serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'راهنمای ثبت آگهی' },
  { title: 'Posting guide' },
);

export default async function GuidePage() {
  const lang = await getLanguage();
  const t = (fa: string, en?: string) => serverT(lang, fa, en);
  const guidance = [
    {
      title: t('۱. نوع آگهی را انتخاب کنید', '1. Choose the listing type'),
      body: t(
        'خودرو یا قطعه و لوازم جانبی؛ هر کدام فرم مشخصات خودش را دارد.',
        'A vehicle or a part/accessory; each has its own specification form.',
      ),
    },
    {
      title: t('۲. مشخصات را دقیق وارد کنید', '2. Enter accurate specifications'),
      body: t(
        'برند، مدل، سال، کارکرد، گیربکس و وضعیت پلاک؛ اطلاعات نادرست باعث حذف آگهی می‌شود.',
        'Brand, model, year, mileage, gearbox and plate status; inaccurate information can lead to the listing being removed.',
      ),
    },
    {
      title: t('۳. عکس‌های واقعی بارگذاری کنید', '3. Upload real photos'),
      body: t(
        'حداقل یک عکس؛ اولین عکس کاور آگهی است. عکس‌ها به WebP تبدیل و اطلاعات مخفی آن‌ها حذف می‌شود.',
        'At least one photo; the first becomes the cover. Photos are converted to WebP and hidden metadata is removed.',
      ),
    },
    {
      title: t('۴. قیمت و شماره تماس', '4. Price and contact number'),
      body: t(
        'قیمت به تومان یا درهم وارد می‌شود و در فهرست به تومان، همراه با معادل درهم نمایش داده می‌شود. نمایش شماره اختیاری است.',
        'Enter the price in Toman or AED; the catalogue shows it in Toman with the AED equivalent. Sharing your phone number is optional.',
      ),
    },
    {
      title: t('۵. انتشار', '5. Publish'),
      body: t(
        'آگهی بلافاصله منتشر می‌شود و از «آگهی‌های من» قابل ویرایش، فروش یا بایگانی است.',
        'Your listing goes live immediately and can be edited, marked sold or archived from My ads.',
      ),
    },
  ];

  return (
    <article className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-extrabold">{t('راهنمای ثبت آگهی', 'Posting guide')}</h1>
      <p className="text-sm text-muted">
        {t(
          `هر حساب شخصی می‌تواند تا ${formatAmountLatin(FREE_LISTING_LIMIT)} آگهی فعال داشته باشد. برای آگهی بیشتر، پلن لازم است.`,
          `Each account can have up to ${formatAmountLatin(FREE_LISTING_LIMIT)} active listings. A plan is required for more.`,
        )}
      </p>
      <ol className="space-y-3">
        {guidance.map((step) => (
          <li key={step.title} className="rounded-card border border-line bg-card p-4">
            <p className="font-extrabold">{step.title}</p>
            <p className="mt-1 text-sm leading-7 text-muted">{step.body}</p>
          </li>
        ))}
      </ol>
      <Link href="/new" className="btn-cta inline-flex text-sm">
        {t('ثبت آگهی', 'Post ad')}
      </Link>
    </article>
  );
}
