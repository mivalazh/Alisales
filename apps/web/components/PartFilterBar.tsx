'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  PART_CATEGORY_LABELS,
  partCategories,
  type SearchFilters,
} from '@alisales/schemas';
import { useI18n } from '@/lib/i18n';
import { CustomSelect } from './CustomSelect';

/**
 * Spare-parts filter card.
 *
 * Buyers shop by category and condition, so the old two-row chip strip (with
 * an outline icon on every pill and a chunky grey scrollbar) is replaced by
 * one structured card: a labelled control row — «فیلترهای قطعه», a three-state
 * condition selector, authenticity, warranty and compatibility — above a
 * single text-only category strip with a thin scrollbar.
 *
 * Category / origin / condition / warranty / compatibility live in their own
 * URL params, because the parts page narrows those server-side; search and
 * sort stay in the shared catalog params.
 */

const CONDITION_OPTIONS = [
  { value: '', label: 'همه' },
  { value: 'new', label: 'نو / آکبند' },
  { value: 'stock', label: 'استوک (اصلی وارداتی)' },
  { value: 'used', label: 'کارکرده' },
] as const;

const AUTHENTICITY_OPTIONS = [
  { value: '', label: 'همه' },
  { value: 'original', label: 'اصلی OEM' },
  { value: 'commercial', label: 'تجاری' },
  { value: 'stock', label: 'استوک' },
] as const;

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`whitespace-nowrap rounded-[var(--radius-pill)] border px-3 py-1.5 text-xs font-extrabold transition ${
        active
          ? 'border-cta bg-cta-soft text-ink'
          : 'border-line bg-card text-muted hover:border-line-strong hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

export function PartFilterBar({
  basePath,
  category,
  origin,
  warranty,
  compatibility,
  condition,
}: {
  basePath: string;
  category: string | null;
  origin: string | null;
  warranty: boolean;
  compatibility: string;
  condition: string | null;
  /** Shared catalog filters — the strip keeps them, only its own params change. */
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const [compatOpen, setCompatOpen] = useState(false);
  const [compatDraft, setCompatDraft] = useState(compatibility);
  const compatRoot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!compatOpen) return;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (!compatRoot.current?.contains(event.target as Node)) setCompatOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
    };
  }, [compatOpen]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    const qs = next.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  };

  const active = Boolean(category || origin || warranty || compatibility || condition);

  return (
    <section
      aria-label={t('فیلترهای قطعه', 'Part filters')}
      className="space-y-2.5 rounded-card border border-line bg-card p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-extrabold text-ink">
          {t('فیلترهای قطعه', 'Part filters')}
        </span>

        <div className="w-[170px]">
          <CustomSelect
            value={condition ?? ''}
            onChange={(next) => setParam('pcond', next || null)}
            options={CONDITION_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
            ariaLabel={t('وضعیت قطعه', 'Part condition')}
          />
        </div>

        <div className="w-[150px]">
          <CustomSelect
            value={origin ?? ''}
            onChange={(next) => setParam('origin', next || null)}
            options={AUTHENTICITY_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
            ariaLabel={t('اصالت قطعه', 'Part authenticity')}
          />
        </div>

        <Chip
          active={warranty}
          onClick={() => setParam('warranty', warranty ? null : '1')}
        >
          {t('دارای گارانتی', 'With warranty')}
        </Chip>

        <div ref={compatRoot} className="relative">
          <Chip
            active={Boolean(compatibility)}
            onClick={() => {
              setCompatDraft(compatibility);
              setCompatOpen((v) => !v);
            }}
          >
            {t('سازگاری با خودرو', 'Vehicle compatibility')} ▾
          </Chip>
          {compatOpen && (
            <div className="absolute start-0 top-full z-50 mt-2 w-64 rounded-card border border-line bg-card p-2 shadow-xl">
              <label className="label" htmlFor="compat-input">
                {t('سازگار با خودرو', 'Compatible with vehicle')}
              </label>
              <input
                id="compat-input"
                className="field"
                value={compatDraft}
                onChange={(e) => setCompatDraft(e.target.value)}
                placeholder={t('مثلاً لندکروزر', 'e.g. Land Cruiser')}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCompatDraft('');
                    setParam('compat', null);
                    setCompatOpen(false);
                  }}
                  className="text-[11px] font-bold text-muted underline"
                >
                  {t('حذف', 'Remove')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setParam('compat', compatDraft.trim() || null);
                    setCompatOpen(false);
                  }}
                  className="btn-ghost text-xs"
                >
                  {t('اعمال', 'Apply')}
                </button>
              </div>
            </div>
          )}
        </div>

        {active && (
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params.toString());
              for (const key of ['category', 'origin', 'warranty', 'compat', 'pcond']) next.delete(key);
              const qs = next.toString();
              router.push(qs ? `${basePath}?${qs}` : basePath);
            }}
            className="ms-auto text-[11px] font-bold text-muted underline"
          >
            {t('پاک کردن فیلترها', 'Clear filters')}
          </button>
        )}
      </div>

      <ul
        dir="rtl"
        className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-color:var(--color-line)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-line [&::-webkit-scrollbar-track]:bg-transparent"
      >
        <li className="shrink-0">
          <Chip active={!category} onClick={() => setParam('category', null)}>
            {t('همه قطعات', 'All parts')}
          </Chip>
        </li>
        {partCategories.map((key) => (
          <li key={key} className="shrink-0">
            <Chip active={category === key} onClick={() => setParam('category', key)}>
              {t(PART_CATEGORY_LABELS[key])}
            </Chip>
          </li>
        ))}
      </ul>
    </section>
  );
}
