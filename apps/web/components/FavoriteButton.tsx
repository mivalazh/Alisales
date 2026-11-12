'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { useI18n } from '@/lib/i18n';
import { pushLocalNotification } from '@/lib/local-notifications';

export const FAVORITES_KEY = 'alisales-favorites';

/** Compact snapshot kept with each favorite so the page can render offline. */
export interface FavoriteSnapshot {
  slug: string;
  model: string;
  year: number;
  priceIRR: number;
  /** Cover image (optional) so the favorites grid can show artwork offline. */
  coverUrl?: string;
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
        return [
          {
            ...s,
            model: String(s.model ?? ''),
            year: Number(s.year ?? 0),
            priceIRR: Number(s.priceIRR ?? 0),
            ...(typeof s.coverUrl === 'string' ? { coverUrl: s.coverUrl } : {}),
          },
        ];
      }
      return [];
    });
  } catch {
    return [];
  }
}

/** Single writer for the device list — mirrors live in one place. */
export function writeFavorites(items: FavoriteSnapshot[]): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(items));
  } catch {
    // private mode — the in-memory state still reflects the tap
  }
}

/** Merge one snapshot into the device list, keeping the newest fields. */
function upsert(snapshot: FavoriteSnapshot, fields?: Omit<FavoriteSnapshot, 'slug'>) {
  const current = readFavorites();
  const existing = current.find((f) => f.slug === snapshot.slug);
  const merged: FavoriteSnapshot = {
    ...existing,
    ...snapshot,
    ...(fields ?? {}),
  };
  const next = existing
    ? current.map((f) => (f.slug === snapshot.slug ? merged : f))
    : [...current, merged];
  writeFavorites(next);
  return next;
}

/**
 * Favorite toggle — one tap from a card or the detail page.
 *
 * The device list always updates immediately (guests included) and is the
 * rendered state, so the bookmark survives navigation and reload. When a listing
 * id is present the account list is synced too; a 401 simply means the visitor
 * is browsing as a guest.
 */
export function FavoriteButton({
  slug,
  listingId,
  snapshot,
  compact = false,
  className = '',
}: {
  slug: string;
  listingId?: string;
  snapshot?: {
    model: string;
    year: number;
    priceIRR: number;
    coverUrl?: string;
  };
  /** Small overlay button for the card photo (contrast backdrop). */
  compact?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const [active, setActive] = useState(false);
  // Cards pass a fresh snapshot object each render; a ref keeps the effect from
  // re-fetching while still mirroring the latest fields.
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  useEffect(() => {
    let cancelled = false;
    setActive(readFavorites().some((f) => f.slug === slug));
    if (!listingId) return;
    void (async () => {
      try {
        const res = await fetch('/api/favorites');
        if (!res.ok) return;
        const data = (await res.json()) as { ids?: string[] };
        if (cancelled || !Array.isArray(data.ids)) return;
        setActive(data.ids.includes(listingId));
        // Keep the device mirror in step with the account so a reload off the
        // detail page still shows the bookmark.
        if (data.ids.includes(listingId)) {
          upsert({ slug, model: '', year: 0, priceIRR: 0, ...snapshotRef.current });
        }
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
    const isSaved = favorites.some((f) => f.slug === slug);
    if (isSaved) {
      writeFavorites(favorites.filter((f) => f.slug !== slug));
    } else {
      upsert(
        { slug, model: '', year: 0, priceIRR: 0 },
        snapshot,
      );
    }
    const nowActive = !isSaved;
    setActive(nowActive);

    if (nowActive) {
      const text = [snapshot?.model, snapshot?.year].filter(Boolean).join(' ');
      pushLocalNotification({
        kind: 'saved',
        title: t('آگهی ذخیره شد', 'Listing saved'),
        body: text
          ? t(`${text} به ذخیره‌شده‌های شما اضافه شد.`, `${text} was added to your saved listings.`)
          : t('این آگهی به ذخیره‌شده‌های شما اضافه شد.', 'This listing was added to your saved listings.'),
        href: `/listing/${slug}`,
      });
    }

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

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={active}
        aria-label={
          active
            ? t('حذف از ذخیره‌شده‌ها', 'Remove from saved')
            : t('ذخیره آگهی', 'Save listing')
        }
        className={`flex h-9 w-9 items-center justify-center rounded-full shadow-md backdrop-blur transition active:scale-95 ${className}`}
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.88)',
          color: active ? '#F98513' : '#111144',
        }}
      >
        <Icon name={active ? 'bookmarkFilled' : 'bookmark'} size={18} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={active}
      aria-label={
        active
          ? t('حذف از ذخیره‌شده‌ها', 'Remove from saved')
          : t('ذخیره آگهی', 'Save listing')
      }
      className={`flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card transition hover:border-line-strong ${className}`}
      style={{ color: active ? '#F98513' : 'var(--color-text-secondary)' }}
    >
      <Icon name={active ? 'bookmarkFilled' : 'bookmark'} size={20} />
    </button>
  );
}
