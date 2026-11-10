'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FAVORITES_KEY, readFavorites, writeFavorites, type FavoriteSnapshot } from './FavoriteButton';
import { Icon } from './Icon';
import { PriceText } from './PriceText';
import { ViewModeToggle, type ViewMode } from './SortControl';
import { isPreSizedSource } from '@/lib/images';
import { useI18n } from '@/lib/i18n';

const VIEW_KEY = 'alisales-favorites-view';

/**
 * Device-local favorites for guests — a two-column phone / four-column desktop
 * grid with a compact list toggle. Removing an item writes the same device key
 * the card heart uses, so both stay in step.
 */
export function FavoritesList() {
  const { t } = useI18n();
  const [items, setItems] = useState<FavoriteSnapshot[] | null>(null);
  const [view, setView] = useState<ViewMode>('grid');

  useEffect(() => {
    setItems(readFavorites());
    try {
      const stored = localStorage.getItem(VIEW_KEY);
      if (stored === 'grid' || stored === 'row') setView(stored);
    } catch {
      // private mode — grid stays
    }
  }, []);

  const changeView = (mode: ViewMode) => {
    setView(mode);
    try {
      localStorage.setItem(VIEW_KEY, mode);
    } catch {
      // private mode — session-only view
    }
  };

  const remove = (slug: string) => {
    const next = readFavorites().filter((f) => f.slug !== slug);
    writeFavorites(next);
    setItems(next);
  };

  if (items === null) return null;

  if (items.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line-strong bg-card px-6 py-16 text-center">
        <Icon name="heart" size={40} className="mx-auto text-faint" />
        <p className="mt-4 font-extrabold">
          {t('هنوز آگهی‌ای ذخیره نکرده‌اید.', 'You have not saved any listings yet.')}
        </p>
        <p className="mt-1 text-sm text-muted">
          {t(
            'با نشان کردن آگهی‌ها، اینجا لیست شخصی خود را می‌سازید.',
            'Save listings with the heart and they will appear here.',
          )}
        </p>
        <Link href="/" className="btn-cta mt-6 inline-flex text-sm">
          {t('مرور آگهی‌ها', 'Browse listings')}
        </Link>
      </div>
    );
  }

  if (view === 'row') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-muted">
            {t(`${items.length} آگهی`, `${items.length} listings`)}
          </p>
          <ViewModeToggle value={view} onChange={changeView} />
        </div>
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.slug}
              className="flex items-center justify-between gap-3 rounded-card border border-line bg-card p-4"
            >
              <Link href={`/listing/${item.slug}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">
                  {item.model || item.slug}
                  {item.year ? ` — ${item.year}` : ''}
                </p>
                {item.priceIRR ? <PriceText irr={item.priceIRR} /> : null}
              </Link>
              <RemoveButton onClick={() => remove(item.slug)} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-muted">{items.length} آگهی</p>
        <ViewModeToggle value={view} onChange={changeView} />
      </div>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map((item) => (
          <li
            key={item.slug}
            className="relative overflow-hidden rounded-card border border-line bg-card transition hover:border-line-strong hover:shadow-lg"
          >
            <Link href={`/listing/${item.slug}`} className="block">
              <div className="relative aspect-[var(--photo-aspect)] bg-sunken">
                {item.coverUrl ? (
                  <Image
                    src={item.coverUrl}
                    alt={item.model || item.slug}
                    fill
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    unoptimized={isPreSizedSource(item.coverUrl)}
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-faint">
                    <Icon name="camera" size={28} />
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3">
                <p className="truncate text-sm font-extrabold">{item.model || item.slug}</p>
                {item.year ? <p className="text-xs text-muted">{item.year}</p> : null}
                {item.priceIRR ? <PriceText irr={item.priceIRR} /> : null}
              </div>
            </Link>
            <span className="absolute top-2 end-2">
              <RemoveButton onClick={() => remove(item.slug)} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      aria-label={t('حذف از علاقه‌مندی‌ها', 'Remove from saved')}
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-md backdrop-blur transition hover:opacity-90"
      style={{ backgroundColor: 'rgba(255, 255, 255, 0.88)', color: '#111144' }}
    >
      <Icon name="close" size={16} />
    </button>
  );
}

export { FAVORITES_KEY };
