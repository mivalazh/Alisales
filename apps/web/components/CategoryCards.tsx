'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

/** Catalog scope shared with the home page (`?kind=` in the URL). */
export type CatalogKind = 'vehicle' | 'part' | null;

/**
 * The two headline category cards.
 *
 * Each card is a photographic tile that links to that category's own browse
 * page (`/cars` or `/parts`), where the full search bar and filter panel live.
 * A real car/engine photo sits under a bottom-up #111144 gradient so the white
 * title stays legible on any frame, with an #F98513 count pill on top.
 */
export function CategoryCards({
  vehicleCount,
  partCount,
}: {
  vehicleCount: number;
  partCount: number;
}) {
  const { t } = useI18n();
  const cards = [
    {
      key: 'vehicle' as const,
      href: '/cars',
      label: 'خودرو',
      count: vehicleCount,
      image: '/covers/category-car.jpg',
    },
    {
      key: 'part' as const,
      href: '/parts',
      label: 'قطعات و لوازم یدکی',
      count: partCount,
      image: '/covers/category-part.jpg',
    },
  ];

  return (
    <div className="my-3 grid grid-cols-2 gap-3">
      {cards.map((card) => (
        <Link
          key={card.key}
          href={card.href}
          className="group relative flex min-h-[120px] items-end overflow-hidden rounded-2xl bg-[#111144] text-start shadow-sm ring-1 ring-black/5 transition-all hover:ring-2 hover:ring-[#F98513]/70 dark:ring-white/10 sm:min-h-[148px]"
        >
          {/* A plain bundled JPEG, not the image optimizer: Safari on iOS has
              shown a broken-image glyph for the optimized WebP path, while a
              same-origin `/covers/*.jpg` loads everywhere. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.image}
            alt=""
            width={720}
            height={720}
            loading="eager"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#111144]/90 via-[#111144]/45 to-transparent"
          />
          <span className="relative z-10 flex w-full flex-col items-start gap-2 p-3">
            <span className="text-sm font-extrabold leading-tight text-white drop-shadow-[0_1px_2px_rgba(17,17,68,0.6)] sm:text-base">
              {t(card.label)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F98513] px-2.5 py-1 text-[11px] font-extrabold text-[#111144] shadow-sm sm:text-xs">
              <span>{card.count.toLocaleString('en-US')}</span>
              <span>{t('آگهی', 'Listings')}</span>
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
