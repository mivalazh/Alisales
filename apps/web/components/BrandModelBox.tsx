'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { brandsForCategory, type VehicleCategory } from '@alisales/schemas';
import { scrollToResults } from '@/lib/scroll';
import { useI18n } from '@/lib/i18n';
import { BrandEmblem } from './BrandEmblem';
import { Icon } from './Icon';

/**
 * Vehicle brand box (OpenSooq flow), now a single in-place surface:
 *
 *  • No brand picked → a searchable, horizontally scrollable 2-row row of the
 *    category's marques.
 *  • A brand picked → that same slot is *replaced* by a 2-row, horizontally
 *    scrollable model grid («همه مدل‌ها» first) with a «بازگشت به همه برندها»
 *    chip — no second box appears below.
 *  • A model tap commits `?brand=&model=`, then the page scrolls to the first
 *    result card so the buyer sees the narrowed grid immediately.
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

/** Shared 2-row scroller geometry for both the brand and model surfaces. */
const TWO_ROW_GRID =
  'mt-3 grid w-full max-w-full grid-flow-col grid-rows-2 gap-2.5 overflow-x-auto overscroll-x-contain pb-2 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/70';

/** Horizontal drag-to-scroll for the rows (mouse only; touch is native). */
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
  const { t } = useI18n();
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

  /** Model tap: commit, then bring the first result card into view. */
  const pickModel = (name: string | null) => {
    if (!active) return;
    onPick(active.slug, name);
    scrollToResults();
  };

  return (
    <section
      aria-label={t(CATEGORY_TITLE[category])}
      className="rounded-card border border-line bg-card p-3 sm:p-4"
    >
      {active ? (
        <>
          {/* The brand grid is replaced, not duplicated below. */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onPick('');
                setQuery('');
              }}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-line bg-page px-3 py-1.5 text-xs font-extrabold text-ink transition hover:border-line-strong"
            >
              <Icon name="arrowLeft" size={14} />
              {t('بازگشت به همه برندها', 'Back to all brands')}
              <span className="text-muted" dir="ltr">
                ({active.latin})
              </span>
            </button>
            <span className="text-[11px] font-bold text-faint">
              {models.length > 0
                ? t(`${models.length} مدل`, `${models.length} models`)
                : t('مدل پیشنهادی نداریم', 'No suggested models')}
            </span>
          </div>

          <ul
            dir="rtl"
            aria-label={t(`مدل‌های ${active.latin}`, `${active.latin} models`)}
            className={`${TWO_ROW_GRID} auto-cols-[112px] sm:auto-cols-[132px]`}
          >
            <ModelTile
              label={t('همه مدل‌ها', 'All models')}
              selected={!model}
              onPick={() => pickModel(null)}
            />
            {models.map((name) => (
              <ModelTile
                key={name}
                label={name}
                selected={model === name}
                onPick={() => pickModel(model === name ? null : name)}
              />
            ))}
          </ul>

          {models.length === 0 && (
            <p className="mt-1 text-[11px] font-bold text-muted">
              {t(
                'برای این برند مدل پیشنهادی نداریم؛ نام مدل را در فیلترها بنویسید.',
                'No suggested models for this brand. Type the model into the filters.',
              )}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-ink">{t(CATEGORY_TITLE[category])}</h2>
            <Link
              href="/support/brand-request"
              className="text-xs font-bold text-muted underline transition hover:text-ink"
            >
              {t('ثبت برند جدید', 'Request New Brand')}
            </Link>
          </div>

          <label className="mt-3 flex items-center gap-2 rounded-field border border-line bg-page px-3">
            <Icon name="search" size={16} className="text-faint" />
            <span className="sr-only">{t(SEARCH_PLACEHOLDER[category])}</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(SEARCH_PLACEHOLDER[category])}
              className="h-10 w-full bg-transparent text-sm font-semibold text-ink outline-none placeholder:text-faint"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={t('پاک کردن جستجوی برند', 'Clear brand search')}
                className="text-faint transition hover:text-ink"
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </label>

          {filtered.length === 0 ? (
            <p className="mt-4 rounded-field border border-dashed border-line-strong px-3 py-6 text-center text-xs font-bold text-muted">
              {t(
                'برندی با این نام پیدا نشد؛ نام برند را در جستجو یا فیلتر مدل بنویسید.',
                'No brand with that name. Try the search or the model filter.',
              )}
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
              className={`${TWO_ROW_GRID} auto-cols-[84px] sm:auto-cols-[92px]`}
            >
              {filtered.map((item) => {
                const selected = item.slug === brand;
                return (
                  <li key={item.slug} className="snap-start">
                    <button
                      type="button"
                      onClick={() => onPick(selected ? '' : item.slug, null)}
                      aria-pressed={selected}
                      title={item.label}
                      className={`flex h-full w-full flex-col items-center justify-center gap-1 rounded-field border px-1 py-2 transition active:scale-95 ${
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
        </>
      )}
    </section>
  );
}

/** One model tile — the same box geometry as a brand tile, 2 rows high. */
function ModelTile({
  label,
  selected,
  onPick,
}: {
  label: string;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <li className="snap-start">
      <button
        type="button"
        onClick={onPick}
        aria-pressed={selected}
        className={`flex h-full w-full items-center justify-center rounded-field border px-2 py-2 text-center text-[11px] font-extrabold leading-tight transition active:scale-95 ${
          selected
            ? 'border-[#F98513] bg-cta-soft text-ink'
            : 'border-transparent bg-page text-muted hover:border-line-strong hover:text-ink'
        }`}
      >
        <bdi>{label}</bdi>
      </button>
    </li>
  );
}

/** Small wrapper so the model row can sit under a heading when embedded. */
export function BrandModelRow({ children }: { children: ReactNode }) {
  return <div className="mt-3">{children}</div>;
}
