'use client';

import { useEffect, useRef } from 'react';
import './globals.css';
import { reportBoundaryError } from '@/lib/monitoring/client';

/**
 * Last-resort error boundary.
 *
 * `global-error` replaces the root layout when the layout itself throws, so it
 * has to render its own `<html>`/`<body>` and pull the stylesheet in directly —
 * otherwise the worst failure in the app would be an unstyled English page.
 * It stays deliberately dependency-free: no header, no providers, no data.
 * The one extra import is the fire-and-forget monitoring report — guarded so
 * it can never throw, and the only way the owner hears about a broken layout.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const reported = useRef(false);
  useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    // The layout is gone, so `window.location` is the only route information
    // that reliably still exists here.
    reportBoundaryError(error, undefined, 'boundary');
  }, [error]);

  return (
    <html lang="fa" dir="rtl">
      <body className="flex min-h-screen items-center justify-center bg-page px-4 py-10 font-sans text-ink antialiased">
        <main className="w-full max-w-md rounded-card border border-line bg-card p-6 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cta-soft text-cta">
            <svg
              aria-hidden="true"
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 8v5" />
              <path d="M12 16.5v.01" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </span>

          <h1 className="mt-4 text-lg font-extrabold">برنامه با خطا مواجه شد</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            در بارگذاری این بخش مشکلی پیش آمد. یک‌بار دیگر تلاش کنید؛ اگر تکرار شد، صفحه را
            ببندید و دوباره باز کنید.
          </p>

          {error.digest ? (
            <p className="mt-3 text-[11px] font-bold text-faint" dir="ltr">
              کد خطا: {error.digest}
            </p>
          ) : null}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button type="button" onClick={reset} className="btn-cta text-sm">
              تلاش دوباره
            </button>
            <a href="/" className="btn-ghost text-sm">
              بازگشت به خانه
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
