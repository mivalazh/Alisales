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

/** Favorites stored locally (auth-backed favorites arrive with Phase 4). */
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

export function FavoriteButton({
  slug,
  snapshot,
}: {
  slug: string;
  snapshot?: Omit<FavoriteSnapshot, 'slug'>;
}) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(readFavorites().some((f) => f.slug === slug));
  }, [slug]);

  const toggle = () => {
    const favorites = readFavorites();
    const next = favorites.some((f) => f.slug === slug)
      ? favorites.filter((f) => f.slug !== slug)
      : [...favorites, { slug, model: snapshot?.model ?? '', year: snapshot?.year ?? 0, priceIRR: snapshot?.priceIRR ?? 0 }];
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {
      // private mode — the visual state still reflects the tap
    }
    setActive(next.some((f) => f.slug === slug));
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
