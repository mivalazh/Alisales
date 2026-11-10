'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { useI18n } from '@/lib/i18n';

/** Model years shown newest-first in the grid. */
const YEARS = Array.from({ length: 32 }, (_, index) => 2026 - index);

/**
 * «سال ساخت» as a 4-column grid popover.
 *
 * The same control the filter panel uses, extracted so the publish form and
 * every filter speak one visual language: theme tokens for the cells, brand
 * orange (#F98513) for the selected year, and a compact panel that never
 * pushes the form down.
 */
export function YearGridSelect({
  id,
  value,
  onChange,
  placeholder,
  invalid = false,
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (year: string) => void;
  placeholder?: string;
  invalid?: boolean;
  ariaLabel?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const selected = Number.parseInt(value, 10);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ?? t('سال ساخت', 'Model year')}
        onClick={() => setOpen((v) => !v)}
        className={`field flex items-center justify-between gap-2 text-start ${
          invalid ? 'border-2 border-red-500 bg-red-50/40 dark:bg-red-950/20' : ''
        }`}
      >
        <span className={`${value ? 'font-bold text-ink' : 'text-faint'}`}>
          {value || placeholder || t('سال ساخت را انتخاب کنید…', 'Choose a model year…')}
        </span>
        <Icon
          name="chevronDown"
          size={16}
          className={`shrink-0 text-faint transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={ariaLabel ?? t('سال ساخت', 'Model year')}
          className="absolute inset-x-0 top-full z-40 mt-2 rounded-card border border-line bg-card p-3 shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-extrabold text-muted">
            <span>{t('سال ساخت (میلادی)', 'Model year')}</span>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="text-cta underline"
              >
                {t('پاک کردن', 'Clear')}
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {YEARS.map((year) => {
              const active = selected === year;
              return (
                <button
                  key={year}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    onChange(String(year));
                    setOpen(false);
                  }}
                  className={`rounded-field border py-1.5 text-xs font-extrabold tabular-nums transition ${
                    active
                      ? 'border-[#F98513] bg-[#F98513] text-white'
                      : 'border-line bg-page text-muted hover:border-cta hover:text-ink'
                  }`}
                >
                  {year}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
