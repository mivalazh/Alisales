'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { useI18n } from '@/lib/i18n';

/**
 * Floating «back to top» control — icon only.
 *
 * It appears after roughly one screen of scrolling, so a short page never
 * carries a control that does nothing. Nothing is printed: the button is a
 * 44×44 circular surface holding one brand-orange chevron, whose accessible
 * name lives in `aria-label`. It sits above the mobile tab bar and clears it
 * on every width, and the reveal is a fade + slide with no layout shift.
 */
const SCROLL_RATIO = 1;

export function BackToTop() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      setVisible(window.scrollY > window.innerHeight * SCROLL_RATIO);
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
      aria-label={t('بازگشت به بالا', 'Back to top')}
      title={t('بازگشت به بالا', 'Back to top')}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-24 left-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/80 bg-white/95 text-[#F98513] shadow-lg backdrop-blur-md transition-all duration-300 ease-out hover:scale-105 dark:border-white/15 dark:bg-[#161A38]/95 sm:bottom-8 sm:left-6 ${
        visible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <Icon name="chevronDown" size={20} className="rotate-180" />
    </button>
  );
}
