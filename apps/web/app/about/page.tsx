import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'درباره‌ی ما' };

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 text-sm leading-7">
      <h1 className="text-xl font-extrabold">درباره‌ی Ali Sales</h1>
      <p className="text-muted">
        Ali Sales بازار خودرو و قطعات کیش است: خودروهای وارداتی لوکس تا خودروهای روزمره و قطعات
        یدکی، همه در یک فهرست با فیلترهای دقیق و آگهی‌های قابل اعتماد.
      </p>
      <p className="text-muted">
        هدف ما ساده است: خریدار بدون تماس‌های بی‌مورد و فروشنده بدون هزینه‌های پنهان به هم برسند.
        نمایش آگهی رایگان است و پرداخت بین خود کاربران انجام می‌شود.
      </p>
    </article>
  );
}
