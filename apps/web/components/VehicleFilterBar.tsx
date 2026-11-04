'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BRAND_LABELS,
  CONDITION_LABELS,
  DEFAULT_FILTERS,
  PLATE_TYPE_LABELS,
  conditions,
  kishUiBrands,
  plateTypes,
  toAsciiDigits,
  type SearchFilters,
} from '@alisales/schemas';
import { countMatches, type FilterableListing } from '@/lib/filter-match';
import { FilterPanel } from './FilterPanel';
import { Icon } from './Icon';

/**
 * Vehicle filter strip — the OpenSooq row of interactive pills above the
 * vehicle grid (`وضعیت`, `برند خودرو`, `مدل`, `تیپ`, `وضعیت پلاک`, `سال ساخت`)
 * plus the `فیلترها` button that opens the full filter modal.
 *
 * Every pill is a real control: it opens a small popover, writes straight into
 * the shared filter object and the Catalog commits that to the URL, so the
 * server re-runs the one search. The modal edits a draft instead, shows a live
 * `مشاهده N خودرو` count against the current result pool, and applies on tap —
 * no navigation per checkbox.
 */
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function toInt(raw: string): number | undefined {
  const ascii = toAsciiDigits(raw).replace(/[^\d]/g, '');
  if (!ascii) return undefined;
  const n = Number.parseInt(ascii, 10);
  return Number.isFinite(n) ? n : undefined;
}

function Pill({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 whitespace-nowrap rounded-[var(--radius-pill)] border px-3 py-1.5 text-xs font-extrabold transition ${
          active
            ? 'border-cta bg-cta-soft text-ink'
            : 'border-line bg-card text-muted hover:border-line-strong hover:text-ink'
        }`}
      >
        {label}
        <span aria-hidden="true" className="text-[10px]">
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute start-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-card border border-line bg-card p-2 shadow-xl">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function OptionList<T extends string>({
  options,
  selected,
  onToggle,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  selected: readonly T[];
  onToggle: (value: T) => void;
}) {
  return (
    <ul className="max-h-64 overflow-y-auto">
      {options.map((option) => (
        <li key={option.value}>
          <label className="flex cursor-pointer items-center gap-2 rounded-field px-2 py-1.5 text-sm font-semibold text-muted transition hover:bg-sunken">
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => onToggle(option.value)}
              className="accent-[var(--color-accent)]"
            />
            {option.label}
          </label>
        </li>
      ))}
    </ul>
  );
}

export function VehicleFilterBar({
  filters,
  pool,
  onChange,
}: {
  filters: SearchFilters;
  /** Current result pool — the modal's live count is computed against it. */
  pool: readonly FilterableListing[];
  onChange: (next: SearchFilters) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<SearchFilters>(filters);

  // A committed filter set is the new starting point for the next modal open.
  useEffect(() => {
    if (!modalOpen) setDraft(filters);
  }, [filters, modalOpen]);

  const activeCount =
    filters.brand.length +
    (filters.model ? 1 : 0) +
    (filters.trim ? 1 : 0) +
    (filters.plateType.length ? 1 : 0) +
    (filters.condition.length ? 1 : 0) +
    (filters.yearFrom !== undefined || filters.yearTo !== undefined ? 1 : 0) +
    (filters.priceFrom !== undefined || filters.priceTo !== undefined ? 1 : 0) +
    (filters.gearbox.length ? 1 : 0) +
    (filters.mileageMax !== undefined ? 1 : 0);

  const draftCount = countMatches(pool, draft);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Pill label="وضعیت" active={filters.condition.length > 0}>
          {() => (
            <OptionList
              options={conditions.map((c) => ({ value: c, label: CONDITION_LABELS[c] }))}
              selected={filters.condition}
              onToggle={(value) => onChange({ ...filters, condition: toggle(filters.condition, value) })}
            />
          )}
        </Pill>

        <Pill label="برند خودرو" active={filters.brand.length > 0}>
          {() => (
            <OptionList
              options={kishUiBrands.map((b) => ({ value: b.slug, label: b.label }))}
              selected={filters.brand}
              onToggle={(value) => onChange({ ...filters, brand: toggle(filters.brand, value) })}
            />
          )}
        </Pill>

        <Pill label={filters.model ? `مدل: ${filters.model}` : 'مدل'} active={Boolean(filters.model)}>
          {(close) => (
            <div className="space-y-2 p-1">
              <label className="label" htmlFor="pill-model">
                مدل
              </label>
              <input
                id="pill-model"
                className="field"
                value={filters.model ?? ''}
                onChange={(e) => onChange({ ...filters, model: e.target.value })}
                placeholder="مثلاً پاترول"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') close();
                }}
              />
              <button type="button" className="btn-ghost w-full text-xs" onClick={close}>
                اعمال
              </button>
            </div>
          )}
        </Pill>

        <Pill label={filters.trim ? `تیپ: ${filters.trim}` : 'تیپ'} active={Boolean(filters.trim)}>
          {(close) => (
            <div className="space-y-2 p-1">
              <label className="label" htmlFor="pill-trim">
                تیپ
              </label>
              <input
                id="pill-trim"
                className="field"
                value={filters.trim ?? ''}
                onChange={(e) => onChange({ ...filters, trim: e.target.value })}
                placeholder="مثلاً VXR"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') close();
                }}
              />
              <button type="button" className="btn-ghost w-full text-xs" onClick={close}>
                اعمال
              </button>
            </div>
          )}
        </Pill>

        <Pill label="وضعیت پلاک" active={filters.plateType.length > 0}>
          {() => (
            <OptionList
              options={plateTypes.map((p) => ({ value: p, label: PLATE_TYPE_LABELS[p] }))}
              selected={filters.plateType}
              onToggle={(value) => onChange({ ...filters, plateType: toggle(filters.plateType, value) })}
            />
          )}
        </Pill>

        <Pill
          label={
            filters.yearFrom !== undefined || filters.yearTo !== undefined
              ? `سال: ${filters.yearFrom ?? '…'} تا ${filters.yearTo ?? '…'}`
              : 'سال ساخت'
          }
          active={filters.yearFrom !== undefined || filters.yearTo !== undefined}
        >
          {() => (
            <div className="grid grid-cols-2 gap-2 p-1">
              <input
                className="field"
                inputMode="numeric"
                value={filters.yearFrom ?? ''}
                onChange={(e) => onChange({ ...filters, yearFrom: toInt(e.target.value) })}
                placeholder="از"
                aria-label="سال از"
              />
              <input
                className="field"
                inputMode="numeric"
                value={filters.yearTo ?? ''}
                onChange={(e) => onChange({ ...filters, yearTo: toInt(e.target.value) })}
                placeholder="تا"
                aria-label="سال تا"
              />
            </div>
          )}
        </Pill>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-pill)] border border-line bg-card px-3 py-1.5 text-xs font-extrabold text-ink transition hover:border-line-strong"
        >
          <Icon name="sliders" size={15} />
          فیلترها
          {activeCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-cta px-1 text-[10px] font-extrabold text-[color:var(--color-text-on-accent)]">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {filters.brand.length > 0 && (
        <p className="text-xs font-bold text-muted">
          برند: {filters.brand.map((b) => BRAND_LABELS[b] ?? b).join(' · ')}
        </p>
      )}

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="فیلترهای خودرو"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-card border border-line bg-page p-3 sm:rounded-card sm:p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-extrabold">فیلتر خودرو</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="بستن فیلترها"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-cta-soft hover:text-ink"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <FilterPanel filters={draft} onChange={setDraft} onClose={() => setModalOpen(false)} />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setDraft({ ...DEFAULT_FILTERS })}
                className="text-xs font-bold text-muted underline transition hover:text-ink"
              >
                حذف همه‌ی فیلترها
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(draft);
                  setModalOpen(false);
                }}
                className="btn-cta text-sm"
              >
                مشاهده {draftCount.toLocaleString('en-US')} خودرو
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
