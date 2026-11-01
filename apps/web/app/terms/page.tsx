import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'قوانین و حریم خصوصی' };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 text-sm leading-7">
      <h1 className="text-xl font-extrabold">قوانین و حریم خصوصی</h1>

      <section className="rounded-card border border-line bg-card p-4">
        <h2 className="font-extrabold">نقش Ali Sales</h2>
        <p className="mt-1 text-muted">
          Ali Sales فقط محل نمایش آگهی است. خرید و فروش و پرداخت بین خود کاربران انجام می‌شود و
          پلتفرم در معامله طرف حساب نیست.
        </p>
      </section>

      <section className="rounded-card border border-line bg-card p-4">
        <h2 className="font-extrabold">اطلاعات حساب</h2>
        <p className="mt-1 text-muted">
          شماره موبایل فقط برای ورود و ارتباط بین خریدار و فروشنده استفاده می‌شود. شماره تماس فقط
          زمانی نمایش داده می‌شود که فروشنده اجازه داده باشد و آگهی فعال باشد.
        </p>
      </section>

      <section className="rounded-card border border-line bg-card p-4">
        <h2 className="font-extrabold">آمار آگهی</h2>
        <p className="mt-1 text-muted">
          بازدید هر کاربر یک بار شمرده می‌شود و هویت بازدیدکنندگان به مالک آگهی نمایش داده نمی‌شود.
        </p>
      </section>

      <section className="rounded-card border border-line bg-card p-4">
        <h2 className="font-extrabold">آگهی‌های نامناسب</h2>
        <p className="mt-1 text-muted">
          هر کاربر می‌تواند آگهی مشکوک را گزارش کند. گزارش‌ها بررسی می‌شوند و آگهی متخلف ممکن است
          پنهان شود.
        </p>
      </section>
    </article>
  );
}
