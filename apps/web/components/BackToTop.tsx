'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { useI18n } from '@/lib/i18n';

/**
 * Floating «بازگشت به بالا» control.
 *
 * It only exists after roughly one screen of scrolling, so it never covers a
 * short page. The label and arrow use a darker orange in the light theme
 * (4.9:1 on white) and brand orange in the dark theme (6.8:1 on navy), and the
 * change is a fade + slide with no layout shift.
 */
const SCROLL_RATIO = 0.9;

export function BackToTop() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      const threshold = Math.max(360, window.innerHeight * SCROLL_RATIO);
      setVisible(window.scrollY > threshold);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] end-4 z-40 inline-flex h-11 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-sm font-extrabold text-[#C2410C] shadow-lg transition-all duration-300 ease-out hover:border-line-strong dark:text-[#F98513] md:bottom-6 ${
        visible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <Icon name="chevronDown" size={18} className="rotate-180" />
      {t('بازگشت به بالا', 'Back to top')}
    </button>
  );
}
