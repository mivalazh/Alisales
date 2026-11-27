'use client';

import { useRef, type KeyboardEvent } from 'react';
import { Icon } from '@/components/Icon';

/** RTL roving selection: forward is left, matching the reading direction. */
function nextIndex(event: KeyboardEvent, count: number, current: number): number | null {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') return (current + 1) % count;
  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') return (current - 1 + count) % count;
  if (event.key === 'Home') return 0;
  if (event.key === 'End') return count - 1;
  return null;
}

/**
 * Compact option cards for a single pick (وضعیت پلاک).
 *
 * Two columns of horizontal cards on a phone, one row of four from 768px; the
 * same component at both sizes, so the pattern never changes shape.
 */
export function RadioCardGroup({
  ariaLabel,
  options,
  value,
  onChange,
  invalid = false,
  className = '',
}: {
  ariaLabel: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
  invalid?: boolean;
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
      className={`grid grid-cols-2 gap-2 md:grid-cols-4 ${className}`.trim()}
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
            className={`flex min-h-[56px] items-center gap-2.5 rounded-xl border px-3 py-2 text-start text-sm font-medium transition ${
              selected
                ? 'border-[#111144] bg-[#111144]/[0.06] text-ink dark:border-[#F98513] dark:bg-white/10'
                : 'border-line bg-card text-muted hover:border-line-strong hover:text-ink'
            } ${invalid && !selected ? 'border-red-400' : ''}`}
          >
            <span
              aria-hidden="true"
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                selected
                  ? 'border-transparent bg-[#111144] text-white dark:bg-[#F98513] dark:text-[#111144]'
                  : 'border-line-strong'
              }`}
            >
              {selected && <Icon name="check" size={12} />}
            </span>
            <span className="min-w-0 leading-5">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
