'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { SearchFilters } from '@alisales/schemas';
import { Icon } from './Icon';

/**
 * Quick-search box with an OpenSooq-style suggestion panel.
 *
 * Focusing the field opens a floating panel with the buyer's recent searches
 * (device-local, capped and clearable), the trending searches of the Kish
 * market, and the popular import brands. Every entry applies immediately: it
 * closes the panel and commits a fresh search, so the panel never leaves a
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
  { label: 'پلاک کیش', patch: { plateType: ['kish'] } },
];

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
}: {
  q: string;
  /** Commit a fresh search (the panel replaces filters rather than stacking). */
  onApply: (patch: Partial<SearchFilters>) => void;
}) {
  const [value, setValue] = useState(q);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

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
          onFocus={() => setOpen(true)}
          placeholder="جستجوی خودرو، برند یا قطعه"
          aria-label="جستجوی آگهی"
          aria-expanded={open}
          className="field pe-10"
        />
      </form>

      {open && (
        <div
          className="absolute inset-x-0 top-full z-40 mt-2 rounded-2xl border border-line bg-white p-4 shadow-xl dark:border-white/10 dark:bg-[#161A38]"
          role="dialog"
          aria-label="پیشنهادهای جستجو"
        >
          {recent.length > 0 && (
            <section className="mb-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-xs font-extrabold text-muted">جستجوهای اخیر</h2>
                <button
                  type="button"
                  onClick={clearRecent}
                  className="text-xs font-bold text-faint transition hover:text-ink"
                >
                  پاک کردن
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

          <section className="mb-4">
            <h2 className="mb-2 text-xs font-extrabold text-muted">بیشترین جستجوها</h2>
            <ul className="flex flex-wrap gap-2">
              {TRENDING.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={() => apply(item.patch, item.label)}
                    className="rounded-[var(--radius-pill)] bg-cta-soft px-3 py-1.5 text-xs font-extrabold text-ink transition hover:opacity-90"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-extrabold text-muted">برندهای محبوب</h2>
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
