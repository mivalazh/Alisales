'use client';

import { useId } from 'react';

/**
 * The one switch used by every binary option in the form.
 *
 * Same 48×28 track and the same navy track in both themes (brand orange once
 * the page is dark), the label is the click target, and every row is its own
 * low, white surface card so the switch never floats on the cream page.
 */
export function ToggleRow({
  checked,
  onChange,
  label,
  hint,
  className = '',
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  className?: string;
}) {
  const uid = useId();
  const labelId = `${uid}-label`;

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-xl border border-[#111144]/10 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(17,17,68,0.03)] dark:border-white/10 dark:bg-white/[0.04] ${className}`.trim()}
    >
      <div className="min-w-0 flex-1">
        <label
          id={labelId}
          htmlFor={`${uid}-switch`}
          className="block cursor-pointer text-sm font-medium leading-5 text-ink"
        >
          {label}
        </label>
        {hint && <p className="mt-0.5 text-xs leading-5 text-muted">{hint}</p>}
      </div>
      <button
        id={`${uid}-switch`}
        type="button"
        role="switch"
        dir="ltr"
        aria-checked={checked}
        aria-labelledby={labelId}
        onClick={() => onChange(!checked)}
        className={`switch-hit relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)] ${
          checked
            ? 'border-transparent bg-[#111144] dark:bg-[#F98513]'
            : 'border-line bg-sunken dark:bg-white/20'
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-6 w-6 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ${
            checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
          }`}
        />
      </button>
    </div>
  );
}
