'use client';

import { useEffect, useRef, useState } from 'react';
import { SORT_LABELS, SORT_OPTION_KEYS, type SortKey } from '@/lib/sort';
import { Icon } from './Icon';

/**
 * Sort control — one compact trigger that opens a menu with the four standard
 * marketplace orders: newest, cheapest, priciest and most viewed. The active
 * order carries a check mark. Sold listings stay anchored at the end in every
 * one of them (enforced by `sortListings`), so the menu never offers a
 * separate "sold last" state.
 */
export function SortControl({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (key: SortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-pill)] border border-line bg-card px-3 py-2 text-xs font-extrabold text-ink transition hover:border-line-strong"
      >
        <span className="text-muted">مرتب‌سازی:</span>
        <span>{SORT_LABELS[value]}</span>
        <Icon
          name="chevronDown"
          size={16}
          className={`text-faint transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="مرتب‌سازی آگهی‌ها"
          className="absolute end-0 top-full z-40 mt-2 w-48 overflow-hidden rounded-2xl border border-line bg-card p-1 shadow-xl"
        >
          {SORT_OPTION_KEYS.map((key) => {
            const active = value === key;
            return (
              <li key={key} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-extrabold transition ${
                    active ? 'bg-cta-soft text-ink' : 'text-muted hover:bg-sunken hover:text-ink'
                  }`}
                >
                  <span>{SORT_LABELS[key]}</span>
                  {active && <Icon name="check" size={16} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export type ViewMode = 'grid' | 'row';

/** Grid ⇄ list toggle — persisted by the Catalog container. */
export function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="نحوه نمایش"
      className="flex items-center rounded-[var(--radius-pill)] border border-line bg-card p-1"
    >
      {(
        [
          { mode: 'grid', icon: 'grid', label: 'نمایش شبکه‌ای' },
          { mode: 'row', icon: 'list', label: 'نمایش فهرستی' },
        ] as const
      ).map(({ mode, icon, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          aria-pressed={value === mode}
          aria-label={label}
          title={label}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
            value === mode ? 'bg-cta-soft text-ink' : 'text-faint hover:text-ink'
          }`}
        >
          <Icon name={icon} size={18} />
        </button>
      ))}
    </div>
  );
}
