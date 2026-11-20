'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { useI18n } from '@/lib/i18n';
import { useModalFocus } from '@/lib/useModalFocus';

/**
 * The one filter panel for vehicle and parts pages.
 *
 * Two placements, identical controls:
 *
 * · `drawer` (phones/tablets): slides in from the physical right edge behind a
 *   translucent scrim and locks the page scroll, because the panel covers most
 *   of a narrow viewport.
 * · `sidebar` (desktop, from `lg`): a static `w-72` card that the catalogue
 *   places beside the listing grid — the same geometry as the home page. It
 *   covers nothing: the grid stays visible and clickable while filtering.
 *
 * The header keeps the clear/close controls, the body scrolls, and the footer
 * with «نمایش N آگهی» stays pinned to the bottom of the panel.
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
  variant = 'drawer',
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
  /** `sidebar` renders the card in place; `drawer` slides it over the page. */
  variant?: 'drawer' | 'sidebar';
  children: ReactNode;
}) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  const sidebar = variant === 'sidebar';

  // Only the drawer layout is modal: the sidebar sits beside the grid, so it
  // must never trap focus or make the results inert.
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)');
    const sync = () => setNarrow(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useModalFocus({ active: open && !sidebar, containerRef: panelRef, onClose, modal: narrow });

  useEffect(() => {
    if (!open || sidebar) return;
    const previous = document.body.style.overflow;
    if (narrow) document.body.style.overflow = 'hidden';
    return () => {
      if (narrow) document.body.style.overflow = previous;
    };
  }, [open, narrow, sidebar]);

  if (!open) return null;

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      className={
        sidebar
          ? 'hidden max-h-[calc(100dvh-9.5rem)] w-full flex-col rounded-card border border-line bg-card focus:outline-none lg:flex'
          : 'filter-drawer pointer-events-auto absolute inset-y-0 right-0 flex w-[min(22.5rem,calc(100vw-2rem))] flex-col border-l border-line bg-page shadow-2xl focus:outline-none'
      }
    >
      <header
        className={
          sidebar
            ? 'flex items-center gap-2 border-b border-line px-3.5 pb-2.5 pt-3'
            : 'flex items-center gap-2 border-b border-line px-4 pt-[max(0.875rem,env(safe-area-inset-top))] pb-3'
        }
      >
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
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-cta-soft hover:text-ink"
        >
          <Icon name="close" size={16} />
        </button>
      </header>

      <div className={sidebar ? 'min-h-0 flex-1 overflow-y-auto px-3.5 py-3' : 'flex-1 overflow-y-auto px-3.5 py-3'}>
        {children}
      </div>

      <footer
        className={sidebar ? 'border-t border-line px-3.5 pb-3 pt-3' : 'border-t border-line bg-card px-3.5 pt-3'}
        style={sidebar ? undefined : { paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        {/* Pinned footer: the result count is always one tap away, however far
            the buyer scrolls through the filter groups. */}
        <button type="button" onClick={onApply} className="btn-cta w-full text-sm">
          {applyLabel}
        </button>
        <span className="sr-only">{t('فیلترها', 'Filters')}</span>
      </footer>
    </div>
  );

  if (sidebar) return panel;

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {/* Scrim is a phone/tablet affordance only: desktop uses the inline
          sidebar, so a scrim would cover the grid for nothing. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="pointer-events-auto absolute inset-0 bg-[#111144]/45 backdrop-blur-[1px] lg:hidden"
      />
      {panel}
    </div>
  );
}
