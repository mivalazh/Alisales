'use client';

import { useRef, type KeyboardEvent } from 'react';

export interface SegmentedOption {
  value: string;
  label: string;
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
 * Two-or-more choice control (نو/کارکرده، تومان/درهم، اتوماتیک/دنده‌ای) with one
 * selected state: an elevated white pill on a tinted track, arrows to move,
 * roving tabindex.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  invalid = false,
  ariaLabel,
  size = 'md',
  className = '',
}: {
  options: readonly SegmentedOption[];
  value: string;
  onChange: (next: string) => void;
  invalid?: boolean;
  ariaLabel: string;
  size?: 'md' | 'sm';
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const current = options.findIndex((option) => option.value === value);

  return (
    <div
      ref={root}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      onKeyDown={(event) => {
        const target = nextIndex(event, options.length, current < 0 ? 0 : current);
        if (target === null) return;
        event.preventDefault();
        const option = options[target];
        if (option) onChange(option.value);
        const buttons = root.current?.querySelectorAll<HTMLElement>('[role="radio"]');
        buttons?.[target]?.focus();
      }}
      className={`flex items-stretch rounded-xl bg-[#E9E4DC] p-1 dark:bg-white/10 ${
        invalid ? 'ring-2 ring-red-500' : ''
      } ${className}`.trim()}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={`flex h-10 flex-1 items-center justify-center rounded-[9px] font-medium transition ${
              size === 'sm' ? 'px-2 text-[13px]' : 'px-3 text-sm'
            } ${
              selected
                ? 'bg-white font-semibold text-[#111144] shadow-sm dark:bg-[#111144] dark:text-white'
                : 'text-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
