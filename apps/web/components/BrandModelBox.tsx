'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { brandsForCategory, type VehicleCategory } from '@alisales/schemas';
import { BrandEmblem } from './BrandEmblem';
import { Icon } from './Icon';

/**
 * Vehicle brand box (OpenSooq flow): a searchable, horizontally scrollable row
 * of the category's marques, each tile showing the monogram mark and the Latin
 * brand name under it. Tapping a tile commits `?brand=` and opens that marque's
 * model row right below, with «همه مدل‌ها» first; tapping a model narrows the
 * grid and the URL keeps both `brand` and `model`.
 *
 * The row scrolls with touch, trackpad and mouse drag (pointer capture), so it
 * behaves the same on a phone and on a desktop without a horizontal wheel.
 */

const CATEGORY_TITLE: Record<VehicleCategory, string> = {
  car: 'برند خودرو',
  motorcycle: 'برند موتور و اسکوتر برقی',
  heavy: 'برند ماشین‌آلات',
};

const SEARCH_PLACEHOLDER: Record<VehicleCategory, string> = {
  car: 'جستجوی برند خودرو...',
  motorcycle: 'جستجوی برند موتور و اسکوتر...',
  heavy: 'جستجوی برند ماشین‌آلات...',
};

/** Horizontal drag-to-scroll for the brand row (mouse only; touch is native). */
function useDragScroll() {
  const ref = useRef<HTMLUListElement>(null);
  const state = useRef<{ down: boolean; startX: number; startScroll: number; moved: boolean }>({
    down: false,
    startX: 0,
    startScroll: 0,
    moved: false,
  });

  const onPointerDown = (event: React.PointerEvent<HTMLUListElement>) => {
    if (event.pointerType !== 'mouse') return;
    const node = ref.current;
    if (!node) return;
    state.current = {
      down: true,
      startX: event.clientX,
      startScroll: node.scrollLeft,
      moved: false,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLUListElement>) => {
    const node = ref.current;
    if (!node || !state.current.down) return;
    const dx = event.clientX - state.current.startX;
    if (Math.abs(dx) > 4) state.current.moved = true;
    node.scrollLeft = state.current.startScroll - dx;
  };

  const end = () => {
    state.current.down = false;
  };

  /** Swallow the click that follows a drag, so dragging never selects a brand. */
  const onClickCapture = (event: React.MouseEvent<HTMLUListElement>) => {
    if (state.current.moved) {
      event.preventDefault();
      event.stopPropagation();
      state.current.moved = false;
    }
  };

  return { ref, onPointerDown, onPointerMove, onPointerUp: end, onPointerLeave: end, onClickCapture };
}

export function BrandModelBox({
  category = 'car',
  brand,
  model,
  onPick,
}: {
  category?: VehicleCategory;
  /** Currently selected brand slug ('' when none). */
  brand: string;
  model: string;
  /** Commits brand/model to the URL; `null` model clears the model filter. */
  onPick: (brandSlug: string, model?: string | null) => void;
}) {
  const [query, setQuery] = useState('');
  const drag = useDragScroll();
  const brands = useMemo(() => brandsForCategory(category), [category]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter(
      (b) =>
        b.label.toLowerCase().includes(q) ||
        b.latin.toLowerCase().includes(q) ||
        b.slug.includes(q) ||
        b.models.some((m) => m.toLowerCase().includes(q)),
    );
  }, [brands, query]);

  const active = brands.find((b) => b.slug === brand) ?? null;
  const models = active ? active.models : [];

  return (
    <section
      aria-label={CATEGORY_TITLE[category]}
      className="rounded-card border border-line bg-card p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold text-ink">{CATEGORY_TITLE[category]}</h2>
        <Link
          href="/new"
          className="text-xs font-bold text-muted underline transition hover:text-ink"
        >
          برند شما نیست؟ آگهی ثبت کنید
        </Link>
      </div>

      <label className="mt-3 flex items-center gap-2 rounded-field border border-line bg-page px-3">
        <Icon name="search" size={16} className="text-faint" />
        <span className="sr-only">{SEARCH_PLACEHOLDER[category]}</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={SEARCH_PLACEHOLDER[category]}
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

      {filtered.length === 0 ? (
        <p className="mt-4 rounded-field border border-dashed border-line-strong px-3 py-6 text-center text-xs font-bold text-muted">
          برندی با این نام پیدا نشد؛ نام برند را در جستجو یا فیلتر مدل بنویسید.
        </p>
      ) : (
        <ul
          ref={drag.ref}
          dir="rtl"
          onPointerDown={drag.onPointerDown}
          onPointerMove={drag.onPointerMove}
          onPointerUp={drag.onPointerUp}
          onPointerLeave={drag.onPointerLeave}
          onClickCapture={drag.onClickCapture}
          className="mt-3 flex snap-x snap-mandatory gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {filtered.map((item) => {
            const selected = item.slug === brand;
            return (
              <li key={item.slug} className="shrink-0 snap-start">
                <button
                  type="button"
                  onClick={() => onPick(selected ? '' : item.slug, null)}
                  aria-pressed={selected}
                  title={item.label}
                  className={`flex w-[76px] flex-col items-center gap-1 rounded-field border px-1 py-2 transition active:scale-95 ${
                    selected
                      ? 'border-cta bg-cta-soft'
                      : 'border-transparent bg-page hover:border-line-strong'
                  }`}
                >
                  <BrandEmblem slug={item.slug} size={34} />
                  <span
                    dir="ltr"
                    className="w-full truncate text-center text-[10px] font-extrabold leading-tight text-ink"
                  >
                    {item.latin}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {active && (
        <div className="mt-2 rounded-field border border-line bg-page p-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-xs font-extrabold text-ink">
              مدل‌های{' '}
              <span dir="ltr" className="inline-block font-bold">
                {active.latin}
              </span>
            </p>
            <span className="text-[11px] font-bold text-faint">{models.length} مدل</span>
          </div>
          <ul dir="rtl" className="mt-2 flex snap-x gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <li className="shrink-0">
              <button
                type="button"
                onClick={() => onPick(active.slug, null)}
                aria-pressed={!model}
                className={`whitespace-nowrap rounded-[var(--radius-pill)] border px-3 py-1.5 text-xs font-extrabold transition ${
                  !model
                    ? 'border-cta bg-cta-soft text-ink'
                    : 'border-line bg-card text-muted hover:border-line-strong hover:text-ink'
                }`}
              >
                همه مدل‌ها
              </button>
            </li>
            {models.length === 0 && (
              <li className="shrink-0">
                <span className="whitespace-nowrap px-1 text-[11px] font-bold text-muted">
                  مدل پیشنهادی نداریم؛ نام مدل را در فیلترها بنویسید.
                </span>
              </li>
            )}
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
                    <bdi>{name}</bdi>
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

/** Small wrapper so the model row can sit under a heading when embedded. */
export function BrandModelRow({ children }: { children: ReactNode }) {
  return <div className="mt-3">{children}</div>;
}
