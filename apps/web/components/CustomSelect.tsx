'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';

export interface SelectOption {
  value: string;
  label: string;
  /** Small grey note on the row's end edge (e.g. the Jalali year). */
  hint?: string;
}

/**
 * The one dropdown used by every form on the site.
 *
 * A native `<select>` opens the grey operating-system popup, which ignores the
 * product typography, the rounded cards and the RTL spacing — and looked
 * nothing like the brand/model combobox right above it. This component renders
 * the same floating card as those comboboxes: a rounded-xl panel with clean
 * hover rows, a check mark on the current value, and full keyboard support
 * (Enter/Space/arrows/Escape).
 */
export function CustomSelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'انتخاب کنید…',
  disabled = false,
  invalid = false,
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Red border when the field failed validation. */
  invalid?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  const openPanel = () => {
    if (disabled) return;
    setActive(options.findIndex((option) => option.value === value));
    setOpen(true);
  };

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div ref={root} className="relative">
      <button
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPanel())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) {
              openPanel();
              return;
            }
            const step = event.key === 'ArrowDown' ? 1 : -1;
            setActive((i) => (i + step + options.length) % Math.max(options.length, 1));
            return;
          }
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            setOpen(false);
            return;
          }
          if ((event.key === 'Enter' || event.key === ' ') && open) {
            event.preventDefault();
            const picked = options[active];
            if (picked) choose(picked.value);
            return;
          }
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
            event.preventDefault();
            openPanel();
          }
        }}
        className={`field flex items-center justify-between gap-2 text-start ${
          invalid ? 'border-2 border-red-500 bg-red-50/40 dark:bg-red-950/20' : ''
        } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
      >
        <span className={`truncate ${selected ? 'font-bold text-ink' : 'text-faint'}`}>
          {selected?.label ?? placeholder}
        </span>
        <Icon
          name="chevronDown"
          size={16}
          className={`shrink-0 text-faint transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-line bg-card p-1 shadow-xl"
        >
          {options.length === 0 && (
            <li className="px-3 py-2 text-xs font-bold text-faint">گزینه‌ای نیست</li>
          )}
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => choose(option.value)}
                  onMouseEnter={() => setActive(index)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition ${
                    isSelected
                      ? 'bg-cta-soft font-extrabold text-ink'
                      : index === active
                        ? 'bg-sunken font-semibold text-ink'
                        : 'font-semibold text-muted'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {option.hint && (
                      <span className="text-[11px] font-bold text-faint">{option.hint}</span>
                    )}
                    {isSelected && <Icon name="check" size={15} className="text-cta" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
