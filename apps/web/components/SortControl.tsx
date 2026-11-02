'use client';

import { SORT_LABELS, type SortKey } from '@/lib/sort';
import { Icon } from './Icon';

/**
 * Sort control — a segmented two-way switch (cheapest / priciest).
 *
 * The default browse ranking (featured, then newest) has no label and is not a
 * selectable option: tapping the active segment again returns to it, which is
 * how the segmented control stays honest without a third button.
 */
export function SortControl({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (key: SortKey) => void;
}) {
  const options = [
    { key: 'priceAsc' as const, label: SORT_LABELS.priceAsc },
    { key: 'priceDesc' as const, label: SORT_LABELS.priceDesc },
  ];

  return (
    <div
      role="group"
      aria-label="مرتب‌سازی آگهی‌ها"
      className="flex items-center rounded-[var(--radius-pill)] border border-line bg-card p-1"
    >
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? 'newest' : option.key)}
            className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-extrabold transition ${
              active ? 'bg-cta text-[color:var(--color-text-on-accent)]' : 'text-muted hover:text-ink'
            }`}
          >
            {option.label}
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
