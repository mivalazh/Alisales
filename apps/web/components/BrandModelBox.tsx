'use client';

import { useMemo, useRef, type ReactNode } from 'react';
import { brandsForCategory, type VehicleCategory } from '@alisales/schemas';
import { BrandLogo } from './BrandLogo';
import { scrollToResults } from '@/lib/scroll';
import { useI18n } from '@/lib/i18n';
import { Icon } from './Icon';

/**
 * Vehicle brand box (OpenSooq flow), now a single in-place surface:
 *
 *  • No brand picked → a horizontally scrollable 2-row row of the category's
 *    marques. No search field: the buyer simply scrolls or swipes the marks.
 *  • A brand picked → the same slot is *replaced* by a compact wrapping row of
 *    model pills («همه مدل‌ها» first) with a «بازگشت به همه برندها» chip — no
 *    second box appears below.
 *  • A model tap commits `?brand=&model=`, then the page scrolls to the first
 *    result card so the buyer sees the narrowed grid immediately.
 *
 * The brand row scrolls with touch, trackpad and mouse drag (pointer capture),
 * so it behaves the same on a phone and on a desktop without a horizontal wheel.
 */

const CATEGORY_TITLE: Record<VehicleCategory, string> = {
  car: 'برند خودرو',
  motorcycle: 'برند موتور و اسکوتر برقی',
  heavy: 'برند ماشین‌آلات',
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
  const { t } = useI18n();
  const drag = useDragScroll();
  const brands = useMemo(() => brandsForCategory(category), [category]);

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
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onPick('')}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius-pill)] border border-line bg-page px-3 py-1.5 text-xs font-extrabold text-ink transition hover:border-line-strong"
            >
              <Icon name="arrowLeft" size={14} />
              {t('بازگشت به همه برندها', 'Back to all brands')}
              <span className="text-muted" dir="ltr">
                ({active.latin})
              </span>
            </button>
          </div>

          {/* Compact model pills: the same choices as the old tiles in a
              fraction of the height, so the grid stays close to the top. */}
          <ul
            dir="rtl"
            aria-label={t(`مدل‌های ${active.latin}`, `${active.latin} models`)}
            className="mt-3 flex flex-wrap gap-1.5"
          >
            <ModelPill
              label={t('همه مدل‌ها', 'All models')}
              selected={!model}
              onPick={() => pickModel(null)}
            />
            {models.map((name) => (
              <ModelPill
                key={name}
                label={name}
                selected={model === name}
                onPick={() => pickModel(model === name ? null : name)}
              />
            ))}
          </ul>

          {models.length === 0 && (
            <p className="mt-2 text-[11px] font-bold text-muted">
              {t(
                'برای این برند مدل پیشنهادی نداریم؛ نام مدل را در فیلترها بنویسید.',
                'No suggested models for this brand. Type the model into the filters.',
              )}
            </p>
          )}
        </>
      ) : (
        <>
          <h2 className="text-sm font-extrabold text-ink">{t(CATEGORY_TITLE[category])}</h2>

          {/* Brand grid: a strict two-row scroller at every width. Phones keep
              the compact 58px slots, so the same number of marks stay reachable
              there; from `sm` up the slots widen (84px, then 96px) but the grid
              keeps two rows and scrolls sideways instead of wrapping into a
              third row, so every mark stays one clean band of logos. */}
          <ul
            ref={drag.ref}
            dir="rtl"
            onPointerDown={drag.onPointerDown}
            onPointerMove={drag.onPointerMove}
            onPointerUp={drag.onPointerUp}
            onPointerLeave={drag.onPointerLeave}
            onClickCapture={drag.onClickCapture}
            className="mt-2.5 grid grid-rows-2 grid-flow-col auto-cols-[58px] gap-1 overflow-x-auto pb-1.5 scroll-smooth overscroll-x-contain sm:auto-cols-[84px] sm:gap-x-4 sm:gap-y-3 sm:pb-2 md:auto-cols-[96px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>li]:snap-start"
          >
            {brands.map((item) => {
              const selected = item.slug === brand;
              return (
                <li key={item.slug}>
                  <button
                    type="button"
                    onClick={() => onPick(selected ? '' : item.slug, null)}
                    aria-pressed={selected}
                    aria-label={item.label}
                    title={item.label}
                    className={`flex min-h-11 w-full items-center justify-center rounded-lg p-0.5 transition hover:bg-cta-soft/60 active:scale-95 ${
                      selected ? 'bg-cta-soft' : ''
                    }`}
                  >
                    <BrandLogo slug={item.slug} name={item.latin} />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/** One model choice — a compact pill instead of a card-sized tile. */
function ModelPill({
  label,
  selected,
  onPick,
}: {
  label: string;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onPick}
        aria-pressed={selected}
        className={`inline-flex min-h-11 items-center justify-center rounded-full border px-3 py-1.5 text-xs font-extrabold leading-tight transition active:scale-95 ${
          selected
            ? 'border-[#F98513] bg-cta-soft text-ink'
            : 'border-line bg-page text-muted hover:border-line-strong hover:text-ink'
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
