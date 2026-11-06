'use client';

import type { SearchFilters } from '@alisales/schemas';

/**
 * Quick filter chips — the four questions a Kish buyer starts with. Each chip
 * writes into the same SearchFilters object the catalog commits to the URL.
 */
export function QuickChips({
  filters,
  onChange,
  className = '',
}: {
  filters: SearchFilters;
  onChange: (f: SearchFilters) => void;
  /** Extra classes — the catalog keeps the chips on one scrollable line on phones. */
  className?: string;
}) {
  const conditionNew = filters.condition.length === 1 && filters.condition[0] === 'new';
  const conditionUsed = filters.condition.length === 1 && filters.condition[0] === 'used';
  const kishPlate = filters.plateType.length === 1 && filters.plateType[0] === 'kish';
  const anyPlate = filters.plateType.length === 0;

  const chips = [
    { id: 'new', label: 'نو', active: conditionNew, apply: () => onChange({ ...filters, condition: conditionNew ? [] : ['new'] }) },
    { id: 'used', label: 'کارکرده', active: conditionUsed, apply: () => onChange({ ...filters, condition: conditionUsed ? [] : ['used'] }) },
    { id: 'kish', label: 'پلاک منطقه آزاد', active: kishPlate, apply: () => onChange({ ...filters, plateType: kishPlate ? [] : ['kish'] }) },
    { id: 'all-plates', label: 'همه‌ی پلاک‌ها', active: anyPlate, apply: () => onChange({ ...filters, plateType: [] }) },
  ];

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          aria-pressed={chip.active}
          onClick={chip.apply}
          className={`rounded-[var(--radius-pill)] border px-3 py-1.5 text-xs font-extrabold transition ${
            chip.active
              ? 'border-cta bg-cta-soft text-ink'
              : 'border-line bg-card text-muted hover:border-line-strong hover:text-ink'
          }`}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
