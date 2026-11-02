'use client';

import Image from 'next/image';
import { Icon } from './Icon';

export type CatalogKind = 'vehicle' | 'part' | null;

/** Latin digits with the Persian noun, e.g. «12 آگهی». */
function countLabel(count: number): string {
  return `${count.toLocaleString('en-US')} آگهی`;
}

/**
 * The two headline category cards. Tapping one filters the feed by `kind`;
 * tapping the active card again returns to the full feed. Each card is a
 * square photographic tile with the count on an #F98513 pill and an orange
 * ring while its filter is applied.
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
    {
      key: 'vehicle' as const,
      label: 'خودرو',
      count: vehicleCount,
      image: '/covers/photos/category-vehicles.webp',
      alt: 'خودروی لوکس در نمایشگاه',
      icon: 'car' as const,
    },
    {
      key: 'part' as const,
      label: 'قطعات و لوازم یدکی',
      count: partCount,
      image: '/covers/photos/category-parts.webp',
      alt: 'قطعات و موتور خودرو',
      icon: 'gear' as const,
    },
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
            className={`relative flex min-h-[120px] flex-col justify-end overflow-hidden rounded-2xl text-start transition sm:min-h-[148px] ${
              active ? 'ring-2 ring-[#F98513] ring-offset-2 ring-offset-[color:var(--color-surface)]' : ''
            }`}
          >
            <Image
              src={card.image}
              alt={card.alt}
              fill
              sizes="(min-width: 640px) 50vw, 50vw"
              unoptimized
              className="object-cover"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#111144]/90 via-[#111144]/45 to-transparent"
            />
            <span className="relative flex flex-col gap-2 p-3">
              <span className="flex items-center gap-1.5 text-sm font-extrabold text-white sm:text-base">
                <Icon name={card.icon} size={18} className="text-[#F98513]" />
                {card.label}
              </span>
              <span className="inline-flex w-fit items-center rounded-full bg-[#F98513] px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                {countLabel(card.count)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
