'use client';

import { useRef, type KeyboardEvent } from 'react';
import { Icon } from '@/components/Icon';

export interface CategoryChoice {
  key: string;
  label: string;
  /** Menu artwork for the category — the same files the drawer uses. */
  iconSrc: string;
}

/** RTL roving selection: forward is left, matching the reading direction. */
function nextIndex(event: KeyboardEvent, count: number, current: number): number | null {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') return (current + 1) % count;
  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') return (current - 1 + count) % count;
  if (event.key === 'Home') return 0;
  if (event.key === 'End') return count - 1;
  return null;
}

/**
 * The four listing types as compact horizontal tiles: menu artwork at the
 * start edge, label inline beside it.
 *
 * 2×2 on a phone (60px tall, no subtitle and no dead space) and one row of
 * four on desktop (52px), matching the form width exactly.
 */
export function CategorySelector({
  ariaLabel,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  options: readonly CategoryChoice[];
  value: string;
  onChange: (next: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const current = options.findIndex((option) => option.key === value);

  return (
    <div
      ref={root}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={(event) => {
        const target = nextIndex(event, options.length, current < 0 ? 0 : current);
        if (target === null) return;
        event.preventDefault();
        const option = options[target];
        if (option) onChange(option.key);
        const buttons = root.current?.querySelectorAll<HTMLElement>('[role="radio"]');
        buttons?.[target]?.focus();
      }}
      className="col-span-full grid grid-cols-2 gap-2 lg:grid-cols-4"
    >
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.key)}
            className={`flex min-h-[60px] items-center gap-2 rounded-xl border px-2.5 py-2 text-start transition lg:min-h-[52px] lg:gap-2.5 lg:px-3 ${
              selected
                ? 'border-[#111144] bg-[#111144]/[0.06] text-ink dark:border-[#F98513] dark:bg-white/10'
                : 'border-line bg-card text-muted hover:border-line-strong hover:text-ink'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={option.iconSrc}
              alt=""
              aria-hidden="true"
              width={24}
              height={24}
              className="h-6 w-6 shrink-0 object-contain"
            />
            <span className="min-w-0 flex-1 text-[12px] font-semibold leading-4 lg:text-[13px]">
              {option.label}
            </span>
            {selected && <Icon name="check" size={16} className="shrink-0 text-ink" />}
          </button>
        );
      })}
    </div>
  );
}
