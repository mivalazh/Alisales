import type { ReactNode } from 'react';

/**
 * One logical block of the publish form.
 *
 * A hairline divider (not a card) separates sections, so the page reads as one
 * flat workspace. Short fields pair up in two columns from 768px; everything
 * else stays full width on a phone. `meta` puts a section-level readout (the
 * photo counter) on the title's end edge.
 */
export function FormSection({
  title,
  hint,
  required = false,
  meta,
  columns = 'two',
  children,
}: {
  title: string;
  hint?: string;
  /** Adds the subtle required marker next to the section title. */
  required?: boolean;
  /** Section-level readout aligned with the title (e.g. «0 از 20»). */
  meta?: ReactNode;
  columns?: 'one' | 'two' | 'three';
  children: ReactNode;
}) {
  return (
    <section className="border-t border-line pt-6 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold leading-6 text-ink">
          {title}
          {required && (
            <span
              aria-hidden="true"
              className="ms-1.5 inline-block h-1.5 w-1.5 -translate-y-px rounded-full bg-[#F98513]/80 align-middle"
            />
          )}
        </h2>
        {meta && (
          <span className="shrink-0 text-xs font-bold tabular-nums text-muted">{meta}</span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs leading-5 text-muted">{hint}</p>}
      <div
        className={`mt-4 grid gap-4 ${
          columns === 'one' ? '' : 'md:grid-cols-2'
        }`}
      >
        {children}
      </div>
    </section>
  );
}
