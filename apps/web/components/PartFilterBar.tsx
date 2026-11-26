'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { PART_CATEGORY_LABELS, partCategories, type PartCategory } from '@alisales/schemas';
import type { ListingCardData } from '@/lib/data/listings';
import { filterByPartCategory, filterPartsByAttributes } from '@/lib/browse';
import { useI18n } from '@/lib/i18n';
import { FilterDrawerShell } from './FilterDrawerShell';

/**
 * Spare-parts filter surface.
 *
 * `/parts` now uses the same geometry as `/cars`: a right-hand drawer that
 * stays open beside the grid on desktop and slides over it on a phone.
 * Category, condition, authenticity,
 * warranty and compatibility are compact wrapping pill tags instead of long
 * checkbox lists. The URL remains the source of truth.
 */

export interface PartFilterValues {
  category: string | null;
  origin: string | null;
  warranty: boolean;
  compatibility: string;
  condition: string | null;
}

export const EMPTY_PART_FILTERS: PartFilterValues = {
  category: null,
  origin: null,
  warranty: false,
  compatibility: '',
  condition: null,
};

const CONDITION_OPTIONS = [
  { value: 'new', label: 'نو / آکبند' },
  { value: 'stock', label: 'استوک (اصلی وارداتی)' },
  { value: 'used', label: 'کارکرده' },
] as const;

const AUTHENTICITY_OPTIONS = [
  { value: 'original', label: 'اصلی OEM' },
  { value: 'commercial', label: 'تجاری' },
  { value: 'stock', label: 'استوک' },
] as const;

/** Live result count for a candidate parts filter set (drawer footer). */
function countParts(pool: readonly ListingCardData[], value: PartFilterValues): number {
  const scoped = value.category
    ? filterByPartCategory(pool, value.category as PartCategory)
    : pool;
  return filterPartsByAttributes(scoped, {
    origin: value.origin,
    warrantyOnly: value.warranty,
    compatibility: value.compatibility,
    condition: value.condition,
  }).length;
}

export function activePartFilterCount(value: PartFilterValues): number {
  return [
    value.category,
    value.origin,
    value.condition,
    value.warranty ? 'warranty' : null,
    value.compatibility.trim() || null,
  ].filter(Boolean).length;
}

function Pill({
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
      className={`inline-flex min-h-11 items-center rounded-full border px-3 py-1.5 text-xs transition active:scale-[0.98] ${
        active
          ? 'border-[#F98513] bg-[#F98513] font-bold text-[#111144] shadow-xs'
          : 'border-slate-200/80 bg-[#F4F1EC] font-medium text-slate-700 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20'
      }`}
    >
      {children}
    </button>
  );
}

function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="border-b border-line pb-3 last:border-0 last:pb-0">
      <legend className="mb-2 text-xs font-extrabold text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  );
}

/** The filter fields shared by the parts drawer at every width. */
export function PartsFilterFields({
  value,
  onChange,
}: {
  value: PartFilterValues;
  onChange: (next: PartFilterValues) => void;
}) {
  const { t } = useI18n();
  const [compat, setCompat] = useState(value.compatibility);

  useEffect(() => {
    setCompat(value.compatibility);
  }, [value.compatibility]);

  const commitCompat = () => {
    const next = compat.trim();
    if (next !== value.compatibility) onChange({ ...value, compatibility: next });
  };

  return (
    <div className="space-y-3">
      <Fieldset legend={t('دسته‌بندی قطعه', 'Part category')}>
        <Pill
          active={!value.category}
          onClick={() => onChange({ ...value, category: null })}
        >
          {t('همه قطعات', 'All parts')}
        </Pill>
        {partCategories.map((key) => (
          <Pill
            key={key}
            active={value.category === key}
            onClick={() =>
              onChange({ ...value, category: value.category === key ? null : key })
            }
          >
            {t(PART_CATEGORY_LABELS[key])}
          </Pill>
        ))}
      </Fieldset>

      <Fieldset legend={t('وضعیت قطعه', 'Part condition')}>
        {CONDITION_OPTIONS.map((option) => (
          <Pill
            key={option.value}
            active={value.condition === option.value}
            onClick={() =>
              onChange({
                ...value,
                condition: value.condition === option.value ? null : option.value,
              })
            }
          >
            {t(option.label)}
          </Pill>
        ))}
      </Fieldset>

      <Fieldset legend={t('اصالت قطعه', 'Part authenticity')}>
        {AUTHENTICITY_OPTIONS.map((option) => (
          <Pill
            key={option.value}
            active={value.origin === option.value}
            onClick={() =>
              onChange({ ...value, origin: value.origin === option.value ? null : option.value })
            }
          >
            {t(option.label)}
          </Pill>
        ))}
      </Fieldset>

      <Fieldset legend={t('گارانتی', 'Warranty')}>
        <Pill
          active={value.warranty}
          onClick={() => onChange({ ...value, warranty: !value.warranty })}
        >
          {t('دارای گارانتی', 'With warranty')}
        </Pill>
      </Fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-extrabold text-ink">
          {t('سازگاری با خودرو', 'Vehicle compatibility')}
        </legend>
        <input
          className="field text-xs"
          value={compat}
          onChange={(event) => setCompat(event.target.value)}
          onBlur={commitCompat}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitCompat();
            }
          }}
          placeholder={t('مثلاً لندکروزر', 'e.g. Land Cruiser')}
          aria-label={t('سازگاری با خودرو', 'Vehicle compatibility')}
        />
      </fieldset>
    </div>
  );
}

function usePartCommit(basePath: string) {
  const router = useRouter();
  const params = useSearchParams();

  return (next: PartFilterValues) => {
    const query = new URLSearchParams(params.toString());
    const setOrDelete = (key: string, value: string | null) => {
      if (value) query.set(key, value);
      else query.delete(key);
    };
    setOrDelete('category', next.category);
    setOrDelete('origin', next.origin);
    setOrDelete('pcond', next.condition);
    setOrDelete('warranty', next.warranty ? '1' : null);
    setOrDelete('compat', next.compatibility.trim() || null);
    query.delete('page');
    const qs = query.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  };
}

/**
 * Parts filter drawer — the same fields with a draft, applied from the footer.
 * Shares the right-hand drawer shell with the vehicle filters.
 */
export function PartsFilterDrawer({
  open,
  basePath,
  value,
  pool,
  onClose,
  variant = 'drawer',
}: {
  open: boolean;
  basePath: string;
  value: PartFilterValues;
  /** Unfiltered parts feed, used for the live «نمایش N آگهی» count. */
  pool: readonly ListingCardData[];
  onClose: () => void;
  /** `sidebar` is the desktop column beside the grid; `drawer` is mobile. */
  variant?: 'drawer' | 'sidebar';
}) {
  const { t } = useI18n();
  const commit = usePartCommit(basePath);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const count = countParts(pool, draft);

  return (
    <FilterDrawerShell
      open={open}
      variant={variant}
      title={t('فیلترها', 'Filters')}
      closeLabel={t('بستن فیلترها', 'Close filters')}
      clearLabel={t('پاک کردن همه', 'Clear all')}
      applyLabel={t(`نمایش ${count} آگهی`, `Show ${count} ads`)}
      onClear={() => setDraft(EMPTY_PART_FILTERS)}
      onApply={() => {
        commit(draft);
        onClose();
      }}
      onClose={onClose}
    >
      <PartsFilterFields value={draft} onChange={setDraft} />
    </FilterDrawerShell>
  );
}
