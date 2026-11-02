'use client';

import Image from 'next/image';

export type CatalogKind = 'vehicle' | 'part' | null;

/**
 * The two headline category cards. Tapping one filters the feed by `kind`;
 * tapping the active card again returns to the full feed.
 *
 * Each card is a vertical, theme-adaptive tile: white with a hairline border in
 * light mode, #161A38 in dark, artwork kept on `object-contain` so it never
 * crops on narrow phones, and an #F98513 ring while its filter is applied.
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
      image: '/covers/category-lexus.svg',
    },
    {
      key: 'part' as const,
      label: 'قطعات و لوازم یدکی',
      count: partCount,
      image: '/covers/category-parts.svg',
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
            className={`flex min-h-[140px] flex-col items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm transition-all hover:border-[#F98513] dark:border-white/10 dark:bg-[#161A38] dark:shadow-none ${
              active ? 'ring-2 ring-[#F98513]' : ''
            }`}
          >
            <span className="flex h-20 w-full items-center justify-center">
              <Image
                src={card.image}
                alt=""
                width={320}
                height={180}
                unoptimized
                className="h-full w-auto object-contain"
              />
            </span>
            <span className="flex flex-col items-center gap-1.5">
              <span className="text-center text-sm font-extrabold leading-tight text-[#111144] dark:text-[#F4F1EC]">
                {card.label}
              </span>
              <span className="rounded-full bg-[#F98513]/10 px-2 py-0.5 text-xs font-bold text-[#F98513]">
                {card.count.toLocaleString('en-US')}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
