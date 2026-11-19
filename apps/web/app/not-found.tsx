import Link from 'next/link';

/**
 * Branded 404.
 *
 * It renders inside the root layout, so the header, footer and bottom nav stay
 * put and the visitor can leave in one tap. Persian is hardcoded on purpose:
 * this is the fallback for a URL that may not resolve a locale at all, so it
 * must never render Next's English default.
 */
export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-10 text-center">
      <span className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-line bg-card shadow-sm">
        <span aria-hidden="true" className="absolute inset-x-4 -bottom-px h-[3px] rounded-full bg-[#F98513]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-icon.svg" alt="" width={44} height={44} className="h-11 w-11" />
      </span>

      <p
        className="mt-5 text-[56px] font-black leading-none tracking-tight text-[#223382] dark:text-white"
        dir="ltr"
      >
        ۴۰۴
      </p>

      <h1 className="mt-2 text-lg font-extrabold text-ink">صفحه پیدا نشد</h1>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
        نشانی‌ای که باز کرده‌اید وجود ندارد یا جابه‌جا شده است. می‌توانید از همین‌جا ادامه
        دهید.
      </p>

      <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-center">
        <Link href="/" className="btn-cta text-sm">
          بازگشت به خانه
        </Link>
        <Link href="/cars" className="btn-ghost text-sm">
          مشاهده آگهی‌ها
        </Link>
      </div>

      <p className="mt-6 text-[11px] font-bold leading-5 text-faint">
        اگر فکر می‌کنید این یک خطاست، به{' '}
        <a href="mailto:support@alisales.ir" className="text-cta underline underline-offset-2">
          پشتیبانی
        </a>{' '}
        بنویسید.
      </p>
    </section>
  );
}
