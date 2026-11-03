'use client';

import Image from 'next/image';

export type CatalogKind = 'vehicle' | 'part' | null;

/**
 * The two headline category cards. Tapping one filters the feed by `kind`;
 * tapping the active card again returns to the full feed.
 *
 * Each card is a square-ish photographic tile: a real car/engine photo under a
 * bottom-up #111144 gradient so the white title stays legible on any frame, an
 * #F98513 count pill, and an #F98513 ring while its filter is applied. The
 * gradient is the same in both themes — the photo, not the palette, sets the
 * card's colour.
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
      image: '/covers/category-car.webp',
    },
    {
      key: 'part' as const,
      label: 'قطعات و لوازم یدکی',
      count: partCount,
      image: '/covers/category-part.webp',
    },
  ];

  return (
    <div className="my-3 grid grid-cols-2 gap-3">
      {cards.map((card) => {
        const active = kind === card.key;
        return (
          <button
            key={card.key}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(active ? null : card.key)}
            className={`group relative flex min-h-[120px] items-end overflow-hidden rounded-2xl bg-[#111144] text-start shadow-sm transition-all sm:min-h-[148px] ${
              active
                ? 'ring-2 ring-[#F98513]'
                : 'ring-1 ring-black/5 hover:ring-[#F98513]/60 dark:ring-white/10'
            }`}
          >
            <Image
              src={card.image}
              alt=""
              fill
              sizes="(min-width: 640px) 46vw, 50vw"
              unoptimized
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#111144]/90 via-[#111144]/45 to-transparent"
            />
            <span className="relative z-10 flex w-full flex-col items-start gap-2 p-3">
              <span className="text-sm font-extrabold leading-tight text-white drop-shadow-[0_1px_2px_rgba(17,17,68,0.6)] sm:text-base">
                {card.label}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F98513] px-2.5 py-1 text-[11px] font-extrabold text-[#111144] shadow-sm sm:text-xs">
                <span>{card.count.toLocaleString('en-US')}</span>
                <span>آگهی</span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
