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

interface LiveListing {
  id: string;
  slug: string;
  coverUrl: string | null;
  model: string;
  year: number;
  priceIRR: number;
}

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
 *
 * Each card's artwork comes from the listing itself: the stored snapshot only
 * supplies identity, and the page re-reads the live cover through
 * `/api/listings/lookup`, so a saved card never shows a stale or shared image.
 */
export function FavoritesList() {
  const { t, lang } = useI18n();
  const items = useSyncExternalStore(subscribeFavorites, favoritesSnapshot, () => null);
  const [view, setView] = useState<ViewMode>('grid');
  const [live, setLive] = useState<Record<string, LiveListing>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_KEY);
      if (stored === 'grid' || stored === 'row') setView(stored);
    } catch {
      // private mode — grid stays
    }
  }, []);

  const ids = (items ?? []).flatMap((item) => (item.listingId ? [item.listingId] : []));
  const idsKey = ids.join(',');

  useEffect(() => {
    if (!idsKey) return;
    let cancelled = false;
    fetch(`/api/listings/lookup?ids=${encodeURIComponent(idsKey)}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { items?: LiveListing[] } | null) => {
        if (cancelled || !Array.isArray(data?.items)) return;
        setLive(Object.fromEntries(data.items.map((row) => [row.slug, row])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

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

  const modelOf = (item: FavoriteSnapshot) => live[item.slug]?.model || item.model || item.slug;
  const displayTitle = (item: FavoriteSnapshot) => {
    const title = modelOf(item);
    return lang === 'en' ? translateListingContentToEn(title) : title;
  };
  const coverOf = (item: FavoriteSnapshot) =>
    live[item.slug]?.coverUrl ?? item.coverUrl ?? null;

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
              className="flex items-center justify-between gap-3 rounded-card border border-line bg-card p-3"
            >
              <Link href={`/listing/${item.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
                <SavedThumb src={coverOf(item)} alt={displayTitle(item)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold">
                    {displayTitle(item)}
                    {item.year ? ` — ${item.year}` : ''}
                  </span>
                  {item.priceIRR ? <PriceText irr={item.priceIRR} /> : null}
                </span>
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
        <p className="text-sm font-bold text-muted">
          {t(`${items.length} آگهی`, `${items.length} listings`)}
        </p>
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
                {coverOf(item) ? (
                  <Image
                    src={coverOf(item) as string}
                    alt={displayTitle(item)}
                    fill
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    unoptimized={isPreSizedSource(coverOf(item))}
                    loading="lazy"
                    decoding="async"
                    className="object-cover"
                  />
                ) : (
                  <NoImage />
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

function SavedThumb({ src, alt }: { src: string | null; alt: string }) {
  return (
    <span className="relative block h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-sunken">
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="80px"
          unoptimized={isPreSizedSource(src)}
          loading="lazy"
          decoding="async"
          className="object-cover"
        />
      ) : (
        <NoImage />
      )}
    </span>
  );
}

function NoImage() {
  const { t } = useI18n();
  return (
    <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-faint">
      <Icon name="camera" size={24} />
      <span className="text-[10px] font-bold">{t('بدون عکس', 'No photo')}</span>
    </span>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      aria-label={t('حذف از ذخیره‌شده‌ها', 'Remove from saved')}
      onClick={onClick}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card/90 shadow-md backdrop-blur transition hover:opacity-90"
      style={{ color: '#111144' }}
    >
      <Icon name="close" size={16} />
    </button>
  );
}

export { FAVORITES_KEY };
