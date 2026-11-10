'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useStandalone } from '@/lib/useStandalone';

const REFRESH_THRESHOLD = 64;

/**
 * Installed-app runtime.
 *
 * In a browser tab this renders nothing. In an installed PWA (and inside the
 * native shell's web surface) it adds the `app-standalone` class, which hides
 * the marketing footer, uses the frosted native tab bar and keeps scrolling
 * inside the app viewport. It also gives the app a familiar pull-to-refresh at
 * the top of a page; on the web the browser already owns that gesture.
 */
export function AppRuntime() {
  const standalone = useStandalone();
  const { t } = useI18n();
  const [pull, setPull] = useState(0);
  const pullRef = useRef(0);

  useEffect(() => {
    if (
      process.env.NODE_ENV === 'production' &&
      'serviceWorker' in navigator
    ) {
      void navigator.serviceWorker.register('/sw.js').catch(() => {
        // Installation is an enhancement; a blocked service worker must not
        // affect browsing, chat or publishing.
      });
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('app-standalone', standalone);
    if (standalone) root.dataset.appMode = 'standalone';
    else delete root.dataset.appMode;
    return () => {
      root.classList.remove('app-standalone');
      delete root.dataset.appMode;
    };
  }, [standalone]);

  useEffect(() => {
    if (!standalone) return;

    let startY: number | null = null;
    let dragging = false;

    const reset = () => {
      pullRef.current = 0;
      setPull(0);
      startY = null;
      dragging = false;
    };

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || window.scrollY > 0) return;
      startY = event.touches[0]?.clientY ?? null;
      dragging = startY !== null;
    };

    const onMove = (event: TouchEvent) => {
      if (!dragging || startY === null) return;
      const y = event.touches[0]?.clientY ?? startY;
      const delta = y - startY;
      if (delta <= 0 || window.scrollY > 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      const next = Math.min(92, delta * 0.45);
      pullRef.current = next;
      setPull(next);
      if (delta > 8) event.preventDefault();
    };

    const onEnd = () => {
      if (!dragging) return;
      const shouldRefresh = pullRef.current >= REFRESH_THRESHOLD;
      reset();
      if (shouldRefresh) window.location.reload();
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', reset, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', reset);
    };
  }, [standalone]);

  if (!standalone || pull <= 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center"
      style={{ transform: `translateY(${Math.max(10, pull)}px)` }}
    >
      <span className="flex items-center gap-1 rounded-full border border-line bg-card/90 px-3 py-1.5 text-[10px] font-extrabold text-muted shadow-lg backdrop-blur">
        <span className="flex items-center gap-0.5" aria-hidden>
          <span className="h-1 w-1 animate-bounce rounded-full bg-cta [animation-delay:-0.2s]" />
          <span className="h-1 w-1 animate-bounce rounded-full bg-cta [animation-delay:-0.1s]" />
          <span className="h-1 w-1 animate-bounce rounded-full bg-cta" />
        </span>
        {pull >= REFRESH_THRESHOLD
          ? t('برای به‌روزرسانی رها کنید', 'Release to refresh')
          : t('برای به‌روزرسانی بکشید', 'Pull to refresh')}
      </span>
    </div>
  );
}
