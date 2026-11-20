'use client';

import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { Icon } from './Icon';

/**
 * The single navigation control above a listing gallery: one circular arrow
 * button, no title and no second text row. It replaces the old breadcrumb strip
 * plus «بازگشت به آگهی‌ها» label, which cost two rows of vertical space above
 * the photos on every screen size.
 */
export function DetailBackButton({ fallbackHref = '/' }: { fallbackHref?: string }) {
  const router = useRouter();
  const { t } = useI18n();

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push(fallbackHref);
  };

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={t('بازگشت', 'Back')}
      title={t('بازگشت', 'Back')}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 shadow-xs transition hover:border-line-strong active:scale-[0.96] dark:border-white/10 dark:bg-[#161A38]/90"
    >
      <Icon name="arrowLeft" size={18} />
    </button>
  );
}
