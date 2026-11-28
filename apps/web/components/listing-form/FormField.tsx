'use client';

import { useId, type ReactNode } from 'react';
import { Icon } from '@/components/Icon';

/**
 * Label + control + message, with one spacing rhythm everywhere:
 * 8px label→control, 4px control→message.
 *
 * The wrapper is a labelled group so the hint/error caption is announced with
 * the control, and a failed field keeps the existing red `.field-invalid`
 * treatment used by the validation flow.
 */
export function FormField({
  htmlFor,
  label,
  hint,
  error,
  required = false,
  children,
  className = '',
}: {
  htmlFor?: string;
  label: string;
  hint?: string;
  error?: string;
  /** Required fields carry the standard red asterisk. */
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const messageId = `${uid}-message`;

  return (
    <div className={`min-w-0 ${error ? 'field-invalid' : ''} ${className}`.trim()}>
      <label id={labelId} className="label" htmlFor={htmlFor}>
        {label}
        {required && (
          <span aria-hidden="true" className="ms-1 font-semibold text-rose-600 dark:text-rose-400">
            *
          </span>
        )}
      </label>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={error || hint ? messageId : undefined}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
      >
        {children}
      </div>
      {error ? (
        <p id={messageId} className="error-text" role="alert">
          <Icon name="alertCircle" size={13} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={messageId} className="hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
