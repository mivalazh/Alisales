'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  FAVORITES_EVENT,
  FAVORITES_KEY,
  readFavorites,
  writeFavorites,
  type FavoriteSnapshot,
} from './FavoriteButton';
import { Icon } from './Icon';
import { PriceText } from './PriceText';
import { ViewModeToggle, type ViewMode } from './SortControl';
import { ListEmptyState } from './ListEmptyState';
import { isPreSizedSource } from '@/lib/images';
import { useI18n } from '@/lib/i18n';
import { translateListingContentToEn } from '@/lib/i18n/content';

const VIEW_KEY = 'alisales-favorites-view';

/**
 * Device favorites are synchronous. A tiny external store lets the list render
 * them immediately after hydration with no artificial loading state; the
 * server snapshot is empty because localStorage does not exist there.
 */
let favoritesCache: FavoriteSnapshot[] | null = null;

function favoritesSnapshot(): FavoriteSnapshot[] {
  if (favoritesCache === null) favoritesCache = readFavorites();
  return favoritesCache;
}

function subscribeFavorites(onChange: () => void): () => void {
  const refresh = () => {
    favoritesCache = null;
    onChange();
  };
  window.addEventListener(FAVORITES_EVENT, refresh);
  window.addEventListener('storage', refresh);
  return () => {
    window.removeEventListener(FAVORITES_EVENT, refresh);
    window.removeEventListener('storage', refresh);
  };
}

/**
 * Device-local favorites for guests — a two-column phone / four-column desktop
 * grid with a compact list toggle. Removing an item writes the same device key
 * the card bookmark uses, so both stay in step.
 */
export function FavoritesList() {
  const { t, lang } = useI18n();
  const displayTitle = (item: FavoriteSnapshot) =>
    lang === 'en' ? translateListingContentToEn(item.model || item.slug) : item.model || item.slug;
  const items = useSyncExternalStore(subscribeFavorites, favoritesSnapshot, () => null);
  const [view, setView] = useState<ViewMode>('grid');

  useEffect(() => {
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
    writeFavorites(readFavorites().filter((f) => f.slug !== slug));
  };

  // Server render has no localStorage. Leave the space stable for one frame,
  // then the device list appears synchronously after hydration.
  if (items === null) return <div className="min-h-[40vh]" aria-hidden="true" />;

  if (items.length === 0) {
    return (
      <ListEmptyState
        icon="bookmark"
        title={t('هنوز آگهی‌ای ذخیره نکرده‌اید.', 'You have not saved any listings yet.')}
        description={t(
          'با ذخیره کردن آگهی‌ها، اینجا فهرست شخصی خود را می‌سازید.',
          'Save listings with the bookmark and they will appear here.',
        )}
        actionHref="/"
        actionLabel={t('مشاهده آگهی‌ها', 'View listings')}
      />
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
                  {displayTitle(item)}
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
                    alt={displayTitle(item)}
                    fill
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    unoptimized={isPreSizedSource(item.coverUrl)}
                    loading="lazy"
                    decoding="async"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-faint">
                    <Icon name="camera" size={28} />
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3">
                <p className="truncate text-sm font-extrabold">{displayTitle(item)}</p>
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
      aria-label={t('حذف از ذخیره‌شده‌ها', 'Remove from saved')}
      onClick={onClick}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-md backdrop-blur transition hover:opacity-90"
      style={{ backgroundColor: 'rgba(255, 255, 255, 0.88)', color: '#111144' }}
    >
      <Icon name="close" size={16} />
    </button>
  );
}

export { FAVORITES_KEY };
