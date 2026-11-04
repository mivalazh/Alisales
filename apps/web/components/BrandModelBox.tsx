'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BRANDS, kishUiBrands } from '@alisales/schemas';
import { BrandEmblem } from './BrandEmblem';
import { Icon } from './Icon';

/**
 * Vehicle brand box (OpenSooq flow): a searchable, two-row horizontally
 * scrollable carousel of the Kish marques with their emblems. Tapping a tile
 * commits `?brand=` and expands that brand's model row right underneath, so a
 * second tap on a model narrows the grid immediately.
 *
 * The tiles are the filter control itself — no separate page, no dialog. The
 * selected brand stays highlighted and its models stay open, which keeps the
 * current state readable after the server round-trip.
 */
export function BrandModelBox({
  brand,
  model,
  onPick,
}: {
  /** Currently selected brand slug ('' when none). */
  brand: string;
  model: string;
  /** Commits brand/model to the URL; `null` model clears the model filter. */
  onPick: (brandSlug: string, model?: string | null) => void;
}) {
  const [query, setQuery] = useState('');

  const brands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return kishUiBrands;
    return kishUiBrands.filter(
      (b) =>
        b.label.toLowerCase().includes(q) ||
        b.slug.includes(q) ||
        b.models.some((m) => m.toLowerCase().includes(q)),
    );
  }, [query]);

  const active = kishUiBrands.find((b) => b.slug === brand) ?? null;
  const models = active
    ? (BRANDS.find((b) => b.slug === active.slug)?.models ?? []).filter(
        (m, index, all) => all.indexOf(m) === index,
      )
    : [];

  return (
    <section
      aria-label="برند خودرو"
      className="rounded-card border border-line bg-card p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
          <Icon name="car" size={16} className="text-cta" />
          برند خودرو
        </h2>
        <Link
          href="/new"
          className="text-xs font-bold text-muted underline transition hover:text-ink"
        >
          برند شما نیست؟ آگهی ثبت کنید
        </Link>
      </div>

      <label className="mt-3 flex items-center gap-2 rounded-field border border-line bg-page px-3">
        <Icon name="search" size={16} className="text-faint" />
        <span className="sr-only">جستجوی برند خودرو</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجوی برند خودرو..."
          className="h-10 w-full bg-transparent text-sm font-semibold text-ink outline-none placeholder:text-faint"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="پاک کردن جستجوی برند"
            className="text-faint transition hover:text-ink"
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </label>

      {brands.length === 0 ? (
        <p className="mt-4 rounded-field border border-dashed border-line-strong px-3 py-6 text-center text-xs font-bold text-muted">
          برندی با این نام پیدا نشد؛ نام برند را در فیلتر مدل بنویسید.
        </p>
      ) : (
        <ul
          dir="rtl"
          className="mt-3 grid grid-flow-col grid-rows-2 auto-cols-[84px] gap-1.5 overflow-x-auto pb-1 sm:auto-cols-[96px]"
        >
          {brands.map((item) => {
            const selected = item.slug === brand;
            return (
              <li key={item.slug}>
                <button
                  type="button"
                  onClick={() =>
                    setBrandAndModel(item.slug, selected ? '' : item.slug, onPick)
                  }
                  aria-pressed={selected}
                  className={`flex w-full flex-col items-center gap-1 rounded-field border px-1 py-2 transition ${
                    selected
                      ? 'border-cta bg-cta-soft'
                      : 'border-transparent bg-page hover:border-line-strong'
                  }`}
                >
                  <BrandEmblem slug={item.slug} size={38} />
                  <span className="line-clamp-1 text-[11px] font-extrabold text-ink">
                    {item.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {active && (
        <div className="mt-3 rounded-field border border-line bg-page p-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-xs font-extrabold text-ink">
              مدل‌های {active.label}
            </p>
            <button
              type="button"
              onClick={() => onPick(active.slug, null)}
              className="text-[11px] font-bold text-muted underline transition hover:text-ink"
            >
              همه‌ی مدل‌ها
            </button>
          </div>
          <ul dir="rtl" className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {models.map((name) => {
              const selected = model === name;
              return (
                <li key={name} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => onPick(active.slug, selected ? null : name)}
                    aria-pressed={selected}
                    className={`whitespace-nowrap rounded-[var(--radius-pill)] border px-3 py-1.5 text-xs font-extrabold transition ${
                      selected
                        ? 'border-cta bg-cta-soft text-ink'
                        : 'border-line bg-card text-muted hover:border-line-strong hover:text-ink'
                    }`}
                  >
                    {name}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

/**
 * Tile tap: selecting a brand replaces the brand set and drops a model that no
 * longer belongs to it; tapping the selected brand again clears the filter.
 */
function setBrandAndModel(
  slug: string,
  nextBrand: string,
  onPick: (brandSlug: string, model?: string | null) => void,
): void {
  if (!nextBrand) {
    onPick('', null);
    return;
  }
  onPick(slug, null);
}
