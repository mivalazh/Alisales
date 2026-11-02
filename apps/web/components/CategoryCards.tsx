'use client';

import { Icon } from './Icon';

export type CatalogKind = 'vehicle' | 'part' | null;

/**
 * The two headline category cards. Tapping one filters the feed by `kind`;
 * tapping the active card again returns to the full feed.
 */
export function CategoryCards({
  kind,
  vehicleCount,
  partCount,
  onSelect,
}: {
  kind: CatalogKind;
  vehicleCount: number;
  partCount: number;
  onSelect: (next: CatalogKind) => void;
}) {
  const cards = [
    { key: 'vehicle' as const, label: 'خودرو', icon: 'car' as const, count: vehicleCount },
    { key: 'part' as const, label: 'قطعات و لوازم یدکی', icon: 'gear' as const, count: partCount },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card) => {
        const active = kind === card.key;
        return (
          <button
            key={card.key}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(active ? null : card.key)}
            className={`flex items-center gap-3 rounded-card border p-4 text-start transition ${
              active
                ? 'border-cta bg-cta-soft'
                : 'border-line bg-card hover:border-line-strong'
            }`}
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: '#F98513' }}
            >
              <Icon name={card.icon} size={22} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold text-ink">{card.label}</span>
              <span className="mt-0.5 block text-xs font-bold text-muted" dir="ltr">
                {card.count}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
