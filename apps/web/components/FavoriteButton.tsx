'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icon';

export const FAVORITES_KEY = 'alisales-favorites';

/** Compact snapshot kept with each favorite so the page can render offline. */
export interface FavoriteSnapshot {
  slug: string;
  model: string;
  year: number;
  priceIRR: number;
}

/** Device-local favorites — the guest list and an offline mirror for accounts. */
export function readFavorites(): FavoriteSnapshot[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // Back-compat: older entries were plain slug strings.
    return parsed.flatMap((entry): FavoriteSnapshot[] => {
      if (typeof entry === 'string') return [{ slug: entry, model: '', year: 0, priceIRR: 0 }];
      if (
        entry &&
        typeof entry === 'object' &&
        typeof (entry as FavoriteSnapshot).slug === 'string'
      ) {
        const s = entry as FavoriteSnapshot;
        return [{ ...s, model: String(s.model ?? ''), year: Number(s.year ?? 0), priceIRR: Number(s.priceIRR ?? 0) }];
      }
      return [];
    });
  } catch {
    return [];
  }
}

/**
 * Favorite toggle. The device list always updates immediately (works for
 * guests); when a listing id is provided the account list is synced too, and
 * a 401 simply means the user is browsing as a guest.
 */
export function FavoriteButton({
  slug,
  listingId,
  snapshot,
}: {
  slug: string;
  listingId?: string;
  snapshot?: Omit<FavoriteSnapshot, 'slug'>;
}) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setActive(readFavorites().some((f) => f.slug === slug));
    if (!listingId) return;
    void (async () => {
      try {
        const res = await fetch('/api/favorites');
        if (!res.ok) return;
        const data = (await res.json()) as { ids?: string[] };
        if (!cancelled && Array.isArray(data.ids)) setActive(data.ids.includes(listingId));
      } catch {
        // guest / offline — the local state stands
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, listingId]);

  const toggle = () => {
    const favorites = readFavorites();
    const next = favorites.some((f) => f.slug === slug)
      ? favorites.filter((f) => f.slug !== slug)
      : [
          ...favorites,
          {
            slug,
            model: snapshot?.model ?? '',
            year: snapshot?.year ?? 0,
            priceIRR: snapshot?.priceIRR ?? 0,
          },
        ];
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {
      // private mode — the visual state still reflects the tap
    }
    const nowActive = next.some((f) => f.slug === slug);
    setActive(nowActive);

    if (listingId) {
      void (nowActive
        ? fetch('/api/favorites', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ listingId }),
          })
        : fetch(`/api/favorites?listingId=${encodeURIComponent(listingId)}`, {
            method: 'DELETE',
          })
      ).catch(() => null);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={active}
      aria-label={active ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-muted transition hover:border-line-strong hover:text-ink"
    >
      <Icon name={active ? 'heartFilled' : 'heart'} size={20} />
    </button>
  );
}
