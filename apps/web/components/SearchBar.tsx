'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  CHASSIS_CONDITION_LABELS,
  MOTORCYCLE_BRANDS,
  HEAVY_BRANDS,
  PAINT_CONDITION_LABELS,
  carBrands,
  chassisConditions,
  fuzzySuggestions,
  paintConditions,
  type SearchFilters,
} from '@alisales/schemas';
import { useI18n } from '@/lib/i18n';
import { Icon } from './Icon';

/**
 * Quick-search box with an OpenSooq-style suggestion panel.
 *
 * Focusing or clicking the field opens a floating panel with the buyer's recent
 * searches (device-local, capped and clearable), the trending searches of the
 * Kish market, and the popular import brands. Every entry applies immediately:
 * it closes the panel and commits a fresh search, so the panel never leaves a
 * half-applied filter behind.
 */
export const RECENT_SEARCHES_KEY = 'alisales-recent-searches';
const MAX_RECENT = 6;

type BrandSlug = SearchFilters['brand'][number];

const TRENDING: ReadonlyArray<{ label: string; patch: Partial<SearchFilters> }> = [
  { label: 'Land Cruiser VXR', patch: { q: 'Land Cruiser' } },
  { label: 'Patrol Platinum', patch: { q: 'Patrol' } },
  { label: 'Mercedes S500', patch: { q: 'S-Class' } },
  { label: 'BMW X5', patch: { q: 'X5' } },
  { label: 'کیت ترمز پورشه', patch: { q: 'کیت ترمز' } },
  { label: 'پلاک منطقه آزاد', patch: { plateType: ['kish'] } },
];

/** Every searchable word (marque, Latin name, model) — the fuzzy pool. */
const SUGGESTION_POOL: readonly string[] = Array.from(
  new Set([
    ...[...carBrands, ...MOTORCYCLE_BRANDS, ...HEAVY_BRANDS].flatMap((brand) => [
      brand.label,
      brand.latin,
      ...brand.models,
    ]),
    ...paintConditions.map((paint) => PAINT_CONDITION_LABELS[paint]),
    ...chassisConditions.map((chassis) => `شاسی ${CHASSIS_CONDITION_LABELS[chassis]}`),
    'بیمه شخص ثالث',
    'بیمه بدنه',
    'معاینه فنی',
    'اسکوتر برقی',
    'لنت ترمز',
    'یات و قایق تفریحی',
  ]),
);

const BRAND_PILLS: ReadonlyArray<{ slug: BrandSlug; label: string }> = [
  { slug: 'toyota', label: 'Toyota' },
  { slug: 'nissan', label: 'Nissan' },
  { slug: 'mercedes-benz', label: 'Mercedes-Benz' },
  { slug: 'bmw', label: 'BMW' },
  { slug: 'porsche', label: 'Porsche' },
  { slug: 'lexus', label: 'Lexus' },
  { slug: 'kia', label: 'Kia' },
  { slug: 'hyundai', label: 'Hyundai' },
];

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  } catch {
    return [];
  }
}

function writeRecent(list: string[]): void {
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
  } catch {
    // private mode — history lives for this session only
  }
}

export function SearchBar({
  q,
  onApply,
  placeholder = 'جستجوی خودرو، برند یا قطعه',
}: {
  q: string;
  /** Commit a fresh search (the panel replaces filters rather than stacking). */
  onApply: (patch: Partial<SearchFilters>) => void;
  placeholder?: string;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(q);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Typo-tolerant live hints («لندکروز» → Land Cruiser, «پورش» → Porsche).
  const hints = useMemo(
    () => (value.trim().length >= 2 ? fuzzySuggestions(value, SUGGESTION_POOL, 5) : []),
    [value],
  );

  useEffect(() => setValue(q), [q]);
  useEffect(() => setRecent(readRecent()), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const remember = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const next = [trimmed, ...readRecent().filter((item) => item !== trimmed)].slice(0, MAX_RECENT);
    writeRecent(next);
    setRecent(next);
  };

  const apply = (patch: Partial<SearchFilters>, rememberAs?: string) => {
    if (rememberAs) remember(rememberAs);
    setOpen(false);
    onApply(patch);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const term = value.trim();
    apply(term ? { q: term } : {}, term);
  };

  const clearRecent = () => {
    writeRecent([]);
    setRecent([]);
  };

  const show = () => {
    setRecent(readRecent());
    setOpen(true);
  };

  return (
    <div ref={wrapRef} className="relative">
      <form onSubmit={submit} role="search">
        <Icon
          name="search"
          size={18}
          className="pointer-events-none absolute inset-y-0 end-3 my-auto text-faint"
        />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={show}
          onClick={show}
          placeholder={t(placeholder)}
          aria-label={t('جستجوی آگهی', 'Search listings')}
          aria-expanded={open}
          aria-controls="search-suggestions"
          className="field pe-10"
        />
      </form>

      {open && (
        <div
          id="search-suggestions"
          role="dialog"
          aria-label={t('پیشنهادهای جستجو', 'Search suggestions')}
          className="absolute inset-x-0 top-full z-40 mt-2 rounded-2xl border border-line bg-card p-4 shadow-xl"
        >
          {recent.length > 0 && (
            <section className="mb-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-xs font-extrabold text-muted">{t('جستجوهای اخیر', 'Recent searches')}</h2>
                <button
                  type="button"
                  onClick={clearRecent}
                  className="text-xs font-bold text-faint transition hover:text-ink"
                >
                  {t('پاک کردن', 'Clear')}
                </button>
              </div>
              <ul className="flex flex-wrap gap-2">
                {recent.map((term) => (
                  <li key={term}>
                    <button
                      type="button"
                      onClick={() => apply({ q: term }, term)}
                      className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-line bg-page px-3 py-1.5 text-xs font-bold text-ink transition hover:border-line-strong"
                    >
                      <Icon name="clock" size={14} className="text-faint" />
                      {term}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {hints.length > 0 && (
            <section className="mb-4">
              <h2 className="mb-2 text-xs font-extrabold text-muted">{t('پیشنهادهای نزدیک', 'Close matches')}</h2>
              <ul className="flex flex-wrap gap-2">
                {hints.map((hint) => (
                  <li key={hint}>
                    <button
                      type="button"
                      onClick={() => apply({ q: hint }, hint)}
                      className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-cta/40 bg-cta-soft px-3 py-1.5 text-xs font-extrabold text-ink transition hover:border-cta"
                    >
                      <Icon name="search" size={13} className="text-cta" />
                      {hint}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mb-4">
            <h2 className="mb-2 text-xs font-extrabold text-muted">{t('بیشترین جستجوها', 'Trending searches')}</h2>
            <ul className="flex flex-wrap gap-2">
              {TRENDING.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={() => apply(item.patch, item.label)}
                    className="rounded-[var(--radius-pill)] bg-cta-soft px-3 py-1.5 text-xs font-extrabold text-ink transition hover:opacity-90"
                  >
                    {t(item.label)}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-extrabold text-muted">{t('برندهای محبوب', 'Popular brands')}</h2>
            <ul className="flex flex-wrap gap-2">
              {BRAND_PILLS.map((brand) => (
                <li key={brand.slug}>
                  <button
                    type="button"
                    onClick={() => apply({ brand: [brand.slug] }, brand.label)}
                    className="rounded-[var(--radius-pill)] border border-line bg-page px-3 py-1.5 text-xs font-bold text-ink transition hover:border-line-strong"
                  >
                    {brand.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
