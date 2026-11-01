import type { Metadata } from 'next';
import Link from 'next/link';
import { FREE_LISTING_LIMIT, toPersianDigits } from '@alisales/schemas';

export const metadata: Metadata = { title: 'راهنمای ثبت آگهی' };

const STEPS: ReadonlyArray<{ title: string; body: string }> = [
  { title: '۱. نوع آگهی را انتخاب کنید', body: 'خودرو یا قطعه و لوازم جانبی؛ هر کدام فرم مشخصات خودش را دارد.' },
  { title: '۲. مشخصات را دقیق وارد کنید', body: 'برند، مدل، سال، کارکرد، گیربکس و وضعیت پلاک؛ اطلاعات نادرست باعث حذف آگهی می‌شود.' },
  { title: '۳. عکس‌های واقعی بارگذاری کنید', body: 'حداقل یک عکس؛ اولین عکس کاور آگهی است. عکس‌ها به WebP تبدیل و اطلاعات مخفی آن‌ها حذف می‌شود.' },
  { title: '۴. قیمت و شماره تماس', body: 'قیمت به تومان یا درهم وارد می‌شود و به ریال ذخیره می‌شود. نمایش شماره اختیاری است.' },
  { title: '۵. انتشار', body: 'آگهی بلافاصله منتشر می‌شود و از «آگهی‌های من» قابل ویرایش، فروش یا بایگانی است.' },
];

export default function GuidePage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-extrabold">راهنمای ثبت آگهی</h1>
      <p className="text-sm text-muted">
        هر حساب شخصی می‌تواند تا {toPersianDigits(FREE_LISTING_LIMIT)} آگهی فعال داشته باشد. برای
        آگهی بیشتر، پلن لازم است.
      </p>
      <ol className="space-y-3">
        {STEPS.map((step) => (
          <li key={step.title} className="rounded-card border border-line bg-card p-4">
            <p className="font-extrabold">{step.title}</p>
            <p className="mt-1 text-sm leading-7 text-muted">{step.body}</p>
          </li>
        ))}
      </ol>
      <Link href="/new" className="btn-cta inline-flex text-sm">
        ثبت آگهی
      </Link>
    </article>
  );
}
