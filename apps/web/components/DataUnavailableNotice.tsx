'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Icon } from './Icon';

/**
 * Shown when a page's server load hit `DataUnavailableError`.
 *
 * The distinction matters: this card means "we could not read your data just
 * now", never "you have no data". It offers a retry that re-runs the server
 * render in place, so the visitor does not lose their place.
 */
export function DataUnavailableNotice({
  className = '',
}: {
  className?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  function retry(): void {
    setRetrying(true);
    router.refresh();
    // The refresh has no completion signal here; a short visible busy state is
    // enough feedback and avoids a button that looks stuck forever.
    setTimeout(() => setRetrying(false), 1_500);
  }

  return (
    <div
      role="alert"
      className={`rounded-card border border-line bg-card px-6 py-10 text-center ${className}`}
    >
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-cta-soft text-cta">
        <Icon name="alertCircle" size={20} />
      </span>
      <p className="mt-3 text-sm font-extrabold text-ink">
        {t('اطلاعات فعلاً در دسترس نیست', 'This data is temporarily unavailable')}
      </p>
      <p className="mx-auto mt-1 max-w-xs text-xs leading-6 text-muted">
        {t(
          'داده‌های شما پاک نشده‌اند؛ فقط خواندنشان در این لحظه ناموفق بود. کمی بعد دوباره تلاش کنید.',
          'Your data has not been lost — reading it just failed. Please try again in a moment.',
        )}
      </p>
      <button type="button" onClick={retry} disabled={retrying} className="btn-cta mt-4 text-sm">
        {retrying ? t('در حال تلاش…', 'Retrying…') : t('تلاش دوباره', 'Try again')}
      </button>
    </div>
  );
}
