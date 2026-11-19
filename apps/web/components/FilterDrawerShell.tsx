'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { useI18n } from '@/lib/i18n';
import { useModalFocus } from '@/lib/useModalFocus';

/**
 * Right-hand filter drawer — the one filter surface for vehicle and parts
 * pages at every width.
 *
 * It slides in from the physical right edge and never takes the whole screen:
 *
 * · Phones/tablets: a translucent scrim closes it and the page scroll is
 *   locked, because the panel covers most of a narrow viewport.
 * · Desktop: no scrim and no scroll lock. The grid stays visible and clickable
 *   beside the panel, so filtering is not a modal interruption.
 *
 * The header keeps the close control, the body scrolls, and the footer with
 * «نمایش N آگهی» stays pinned to the bottom of the panel.
 */
export function FilterDrawerShell({
  open,
  title,
  closeLabel,
  clearLabel,
  applyLabel,
  onClear,
  onApply,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  closeLabel: string;
  clearLabel: string;
  applyLabel: string;
  onClear: () => void;
  onApply: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);

  // Only the narrow layout is modal: below 1024px the panel covers the grid, so
  // it traps focus and makes the page inert. On desktop the grid must stay
  // usable beside it, so focus just moves into the panel and comes back.
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)');
    const sync = () => setNarrow(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useModalFocus({ active: open, containerRef: panelRef, onClose, modal: narrow });

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    if (narrow) document.body.style.overflow = 'hidden';
    return () => {
      if (narrow) document.body.style.overflow = previous;
    };
  }, [open, narrow]);

  if (!open) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {/* Scrim is a phone/tablet affordance only: on desktop it would cover
          the very grid the drawer is meant to filter beside. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="pointer-events-auto absolute inset-0 bg-[#111144]/45 backdrop-blur-[1px] lg:hidden"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="filter-drawer pointer-events-auto absolute inset-y-0 right-0 flex w-[min(22.5rem,calc(100vw-2rem))] flex-col border-l border-line bg-page shadow-2xl focus:outline-none"
      >
        <header className="flex items-center gap-2 border-b border-line px-4 pt-[max(0.875rem,env(safe-area-inset-top))] pb-3">
          <h2 className="min-w-0 truncate text-sm font-extrabold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClear}
            className="ms-auto shrink-0 rounded-full bg-cta-soft px-2.5 py-1 text-[10px] font-extrabold text-ink transition hover:bg-cta hover:text-white"
          >
            {clearLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200/70 text-ink transition hover:bg-slate-300/80 dark:bg-white/10"
          >
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-3.5 py-3">{children}</div>

        <footer
          className="border-t border-line bg-card px-3.5 pt-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          {/* Pinned footer: the result count is always one tap away, however
              far the buyer scrolls through the filter groups. */}
          <button type="button" onClick={onApply} className="btn-cta w-full text-sm">
            {applyLabel}
          </button>
          <span className="sr-only">{t('فیلترها', 'Filters')}</span>
        </footer>
      </div>
    </div>
  );
}
