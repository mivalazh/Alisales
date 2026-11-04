'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  PART_CATEGORY_LABELS,
  conditions,
  partCategories,
  type SearchFilters,
} from '@alisales/schemas';
import type { IconName } from './Icon';
import { Icon } from './Icon';

/**
 * Spare-parts filter strip.
 *
 * Parts buyers do not shop by car brand, so this strip replaces the vehicle
 * brand box with what actually narrows a part: the category (with an outline
 * icon each), condition and origin chips, a warranty chip and a free-text
 * «سازگاری با خودرو» control.
 *
 * Category / origin / warranty / compatibility live in their own URL params
 * (the parts page filters the rows server-side); condition is part of the
 * shared filter object, so the Catalog commits it exactly like the vehicle
 * page does. Both paths keep search and sort intact.
 */
const CATEGORY_ICONS: Record<string, IconName> = {
  engine: 'gear',
  brake: 'shieldCheck',
  body: 'car',
  electrical: 'sparkle',
  interior: 'user',
  tires: 'mileage',
  oil_filters: 'tag',
  other: 'grid',
};

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
  filters,
  onChange,
}: {
  basePath: string;
  category: string | null;
  origin: string | null;
  warranty: boolean;
  compatibility: string;
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
}) {
  const router = useRouter();
  const params = useSearchParams();
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
    // A new category/origin starts a fresh page of results.
    next.delete('page');
    const qs = next.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  };

  const setCondition = (value: (typeof conditions)[number]) => {
    const list = filters.condition.includes(value)
      ? filters.condition.filter((c) => c !== value)
      : [...filters.condition, value];
    onChange({ ...filters, condition: list });
  };

  return (
    <div className="space-y-3">
      <ul dir="rtl" className="flex gap-1.5 overflow-x-auto pb-1">
        <li className="shrink-0">
          <Chip active={!category} onClick={() => setParam('category', null)}>
            همه قطعات
          </Chip>
        </li>
        {partCategories.map((key) => (
          <li key={key} className="shrink-0">
            <Chip active={category === key} onClick={() => setParam('category', key)}>
              <span className="flex items-center gap-1.5">
                <Icon name={CATEGORY_ICONS[key] ?? 'gear'} size={15} />
                {PART_CATEGORY_LABELS[key]}
              </span>
            </Chip>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip active={origin === 'original'} onClick={() => setParam('origin', origin === 'original' ? null : 'original')}>
          اصل / OEM
        </Chip>
        <Chip
          active={origin === 'commercial'}
          onClick={() => setParam('origin', origin === 'commercial' ? null : 'commercial')}
        >
          تجاری
        </Chip>
        <span aria-hidden className="mx-1 h-5 w-px bg-line" />
        <Chip active={filters.condition.includes('new')} onClick={() => setCondition('new')}>
          نو / آکبند
        </Chip>
        <Chip active={filters.condition.includes('used')} onClick={() => setCondition('used')}>
          استوک / کارکرده
        </Chip>
        <span aria-hidden className="mx-1 h-5 w-px bg-line" />
        <Chip active={warranty} onClick={() => setParam('warranty', warranty ? null : '1')}>
          دارای گارانتی
        </Chip>

        <div ref={compatRoot} className="relative">
          <Chip
            active={Boolean(compatibility)}
            onClick={() => {
              setCompatDraft(compatibility);
              setCompatOpen((v) => !v);
            }}
          >
            سازگاری با خودرو ▾
          </Chip>
          {compatOpen && (
            <div className="absolute start-0 top-full z-50 mt-2 w-64 rounded-card border border-line bg-card p-2 shadow-xl">
              <label className="label" htmlFor="compat-input">
                سازگار با خودرو
              </label>
              <input
                id="compat-input"
                className="field"
                value={compatDraft}
                onChange={(e) => setCompatDraft(e.target.value)}
                placeholder="مثلاً لندکروزر"
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
                  حذف
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setParam('compat', compatDraft.trim() || null);
                    setCompatOpen(false);
                  }}
                  className="btn-ghost text-xs"
                >
                  اعمال
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
