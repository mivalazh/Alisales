'use client';

import { useI18n } from '@/lib/i18n';

/** Minimal close to a browse feed, shown only after at least one listing. */
export function EndOfFeed({ count }: { count: number }) {
  const { t } = useI18n();
  if (count === 0) return null;

  return (
    <div className="mt-8 mb-10">
      <div className="flex items-center gap-3">
        <span aria-hidden className="h-px flex-1 bg-line" />
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-center text-[11px] font-bold text-muted sm:text-xs">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-cta" />
          {t('به انتهای آگهی‌ها رسیدید', "You've reached the end of the listings")}
          {count > 6 && (
            <>
              <span aria-hidden className="mx-1 h-3 w-px bg-line" />
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="font-extrabold text-ink underline-offset-4 transition hover:underline"
              >
                {t('بازگشت به بالا ↑', 'Back to top ↑')}
              </button>
            </>
          )}
        </span>
        <span aria-hidden className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
