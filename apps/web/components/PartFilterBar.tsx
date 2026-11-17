'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { PART_CATEGORY_LABELS, partCategories } from '@alisales/schemas';
import { useI18n } from '@/lib/i18n';

/**
 * Spare-parts filter surface.
 *
 * `/parts` now uses the same geometry as `/cars`: a sticky sidebar on desktop
 * and a slide-over drawer on a phone. Category, condition, authenticity,
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
      className={`inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-xs transition active:scale-[0.98] ${
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

/** The shared fields used by both the desktop sidebar and the mobile drawer. */
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

/** Sticky desktop sidebar — clear action sits in the header, never at the bottom. */
export function PartsFilterSidebar({
  basePath,
  value,
}: {
  basePath: string;
  value: PartFilterValues;
}) {
  const { t } = useI18n();
  const commit = usePartCommit(basePath);

  return (
    <aside className="hidden lg:block lg:w-72 lg:shrink-0">
      <div className="sticky top-[calc(7.75rem+env(safe-area-inset-top))] max-h-[calc(100dvh-9rem-env(safe-area-inset-top))] overflow-y-auto rounded-card border border-line bg-card p-3">
        <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
          <h2 className="text-sm font-extrabold">{t('فیلترها', 'Filters')}</h2>
          <button
            type="button"
            onClick={() => commit(EMPTY_PART_FILTERS)}
            className="rounded-full bg-cta-soft px-2.5 py-1 text-[10px] font-extrabold text-ink transition hover:bg-cta hover:text-white"
          >
            {t('پاک کردن همه', 'Clear all')}
          </button>
        </div>
        <div className="pt-3">
          <PartsFilterFields value={value} onChange={commit} />
        </div>
      </div>
    </aside>
  );
}

/** Mobile slide-over — the same fields with a draft, applied from the footer. */
export function PartsFilterSheet({
  open,
  basePath,
  value,
  onClose,
}: {
  open: boolean;
  basePath: string;
  value: PartFilterValues;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const commit = usePartCommit(basePath);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('فیلترها', 'Filters')}
      className="fixed inset-0 z-50 flex justify-start bg-black/50 lg:hidden"
      onClick={onClose}
    >
      <div
        className="flex h-[100dvh] w-[calc(100vw-1.5rem)] max-w-[340px] flex-col overflow-hidden border-e border-line bg-[#F4F1EC] shadow-2xl dark:bg-[#0B0D1E]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 pt-[max(0.875rem,env(safe-area-inset-top))] pb-3">
          <h2 className="text-sm font-extrabold">{t('فیلترها', 'Filters')}</h2>
          <button
            type="button"
            onClick={() => setDraft(EMPTY_PART_FILTERS)}
            className="ms-auto rounded-full bg-cta-soft px-2.5 py-1 text-[10px] font-extrabold text-ink transition hover:bg-cta hover:text-white"
          >
            {t('پاک کردن همه', 'Clear all')}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('بستن فیلترها', 'Close filters')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200/70 text-ink transition hover:bg-slate-300/80 dark:bg-white/10"
          >
            <span aria-hidden="true" className="text-lg leading-none">×</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3.5 py-3">
          <PartsFilterFields value={draft} onChange={setDraft} />
        </div>

        <div
          className="border-t border-line bg-card px-3.5 py-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={() => {
              commit(draft);
              onClose();
            }}
            className="btn-cta w-full text-sm"
          >
            {t('نمایش نتایج', 'Show results')}
          </button>
        </div>
      </div>
    </div>
  );
}
