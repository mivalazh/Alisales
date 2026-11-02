'use client';

import { SORT_LABELS, SORT_OPTION_KEYS, type SortKey } from '@/lib/sort';
import { Icon } from './Icon';

/**
 * Sort control — the four standard marketplace orders: newest, cheapest,
 * priciest and most viewed. Sold listings stay anchored at the end in every
 * one of them (enforced by `sortListings`), so the control never has to offer
 * a separate "sold last" state.
 */
export function SortControl({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (key: SortKey) => void;
}) {
  return (
    <div
      role="group"
      aria-label="مرتب‌سازی آگهی‌ها"
      className="flex max-w-full items-center gap-1 overflow-x-auto rounded-[var(--radius-pill)] border border-line bg-card p-1"
    >
      {SORT_OPTION_KEYS.map((key) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(key)}
            className={`shrink-0 whitespace-nowrap rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-extrabold transition ${
              active ? 'bg-cta text-[color:var(--color-text-on-accent)]' : 'text-muted hover:text-ink'
            }`}
          >
            {SORT_LABELS[key]}
          </button>
        );
      })}
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
