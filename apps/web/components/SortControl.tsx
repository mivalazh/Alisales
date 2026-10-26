'use client';

import { SORT_LABELS, SORT_OPTION_KEYS, type SortKey } from '@/lib/sort';
import { Icon } from './Icon';

/**
 * Sort selector — cheapest / priciest (sold-last is always enforced). The
 * default order (featured first, then recency) is not a sort option: while
 * it is active the select rests on an empty, hidden option — no label.
 */
export function SortControl({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (key: SortKey) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-bold text-muted">
      مرتب‌سازی:
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        aria-label="مرتب‌سازی آگهی‌ها"
        className="h-11 rounded-[var(--radius-pill)] border border-line bg-card px-3 text-sm font-bold text-ink"
      >
        {value === 'newest' && <option value="newest" disabled hidden />}
        {SORT_OPTION_KEYS.map((key) => (
          <option key={key} value={key}>
            {SORT_LABELS[key]}
          </option>
        ))}
      </select>
    </label>
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
