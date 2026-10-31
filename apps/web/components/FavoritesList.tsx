'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatPriceLatin } from '@alisales/schemas';
import { FAVORITES_KEY, readFavorites, type FavoriteSnapshot } from './FavoriteButton';
import { Icon } from './Icon';

/** Device-local favorites — re-renders after mount to avoid SSR mismatch. */
export function FavoritesList() {
  const [items, setItems] = useState<FavoriteSnapshot[] | null>(null);

  useEffect(() => {
    setItems(readFavorites());
  }, []);

  if (items === null) return null;

  if (items.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line-strong bg-card px-6 py-16 text-center">
        <Icon name="heart" size={40} className="mx-auto text-faint" />
        <p className="mt-4 font-extrabold">هنوز آگهی‌ای ذخیره نکرده‌اید.</p>
        <p className="mt-1 text-sm text-muted">
          با نشان کردن آگهی‌ها، اینجا لیست شخصی خود را می‌سازید.
        </p>
        <Link href="/" className="btn-cta mt-6 inline-flex text-sm">
          مرور آگهی‌ها
        </Link>
      </div>
    );
  }

  return (
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
            {item.priceIRR ? (
              <p className="mt-0.5 text-sm font-bold text-muted">{formatPriceLatin(item.priceIRR)}</p>
            ) : null}
          </Link>
          <button
            type="button"
            aria-label="حذف از علاقه‌مندی‌ها"
            onClick={() => {
              const next = readFavorites().filter((f) => f.slug !== item.slug);
              try {
                localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
              } catch {
                // private mode — reload reflects the local removal attempt
              }
              setItems(next);
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-cta-soft hover:text-ink"
          >
            <Icon name="close" size={18} />
          </button>
        </li>
      ))}
    </ul>
  );
}
