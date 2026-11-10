'use client';

import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useStandalone } from '@/lib/useStandalone';
import { Icon } from './Icon';

/**
 * iOS/Android-style detail header for installed app mode: a large-touch back
 * target, the screen title and a quiet trailing action. It is intentionally
 * absent in a browser tab, where the site header and breadcrumb already give
 * the same context without duplicating navigation.
 */
export function NativeBackHeader({
  title,
  fallbackHref = '/',
}: {
  title: string;
  fallbackHref?: string;
}) {
  const standalone = useStandalone();
  const router = useRouter();
  const { t } = useI18n();

  if (!standalone) return null;

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push(fallbackHref);
  };

  return (
    <div className="sticky top-16 z-30 -mx-4 mb-3 flex items-center gap-2 border-b border-line bg-card/80 px-3 py-1.5 backdrop-blur-xl sm:-mx-6 sm:px-5 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
      <button
        type="button"
        onClick={goBack}
        className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-1 text-sm font-extrabold text-cta transition active:scale-[0.96]"
        aria-label={t('بازگشت', 'Back')}
      >
        <Icon name="chevronRight" size={22} />
      </button>
      <p className="min-w-0 flex-1 truncate text-sm font-extrabold text-ink">{title}</p>
      <span className="h-11 w-11" aria-hidden />
    </div>
  );
}
