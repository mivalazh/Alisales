'use client';

import { useEffect, useRef, useState } from 'react';
import { CITY_LABELS, DEFAULT_CITY } from '@alisales/schemas';
import { Icon } from './Icon';

/**
 * Kish-first city selector for the sub-header strip.
 *
 * The marketplace launches in the Kish free zone, so Kish is the only active
 * city; the cities the owner plans to open next are listed but disabled, each
 * with a «بزودی» badge, so the roadmap is visible without pretending those
 * inventories exist. The menu is a plain popover: no portal, closes on outside
 * click, Escape and selection.
 */
const UPCOMING_CITIES: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: 'tehran', label: 'تهران' },
  { slug: 'shiraz', label: 'شیراز' },
  { slug: 'isfahan', label: 'اصفهان' },
  { slug: 'mashhad', label: 'مشهد' },
  { slug: 'qeshm', label: 'قشم' },
  { slug: 'dubai', label: 'دبی' },
];

export function CitySelect({ className = '' }: { className?: string }) {
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
    <div ref={root} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-line bg-card px-3 py-1.5 text-sm font-extrabold text-ink transition hover:border-line-strong"
      >
        <Icon name="pin" size={16} className="text-cta" />
        <span>{CITY_LABELS[DEFAULT_CITY]}</span>
        <span aria-hidden="true" className="text-[10px] text-muted">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="انتخاب شهر"
          className="absolute end-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-card border border-line bg-card p-1.5 shadow-xl"
        >
          <button
            type="button"
            role="menuitemradio"
            aria-checked="true"
            onClick={() => setOpen(false)}
            className="flex w-full items-center justify-between gap-2 rounded-field px-2.5 py-2 text-sm font-extrabold text-ink transition hover:bg-cta-soft"
          >
            <span>{CITY_LABELS[DEFAULT_CITY]}</span>
            <Icon name="check" size={16} className="text-cta" />
          </button>

          <div className="my-1 border-t border-line" />

          {UPCOMING_CITIES.map((city) => (
            <button
              key={city.slug}
              type="button"
              role="menuitemradio"
              aria-checked="false"
              aria-disabled="true"
              disabled
              className="flex w-full cursor-not-allowed items-center justify-between gap-2 rounded-field px-2.5 py-2 text-sm font-bold text-muted opacity-50"
            >
              <span>{city.label}</span>
              <span className="rounded-[var(--radius-pill)] border border-line px-1.5 py-0.5 text-[10px] font-extrabold">
                بزودی
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
