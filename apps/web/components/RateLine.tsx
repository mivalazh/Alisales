'use client';

import { formatAedRateLine, formatJalaliDate } from '@alisales/schemas';
import { useAedRate } from './RateProvider';

/** «۱۴۰۵/۰۸/۱۳ · ۲۲:۴۵» — the moment the rate on screen was set. */
function updatedLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  return `${formatJalaliDate(date)} · ${time}`;
}

/**
 * The AED reference line, everywhere it is shown.
 *
 * Both the number and its timestamp come from the one stored rate, so a
 * changed rate updates the sentence and its «آخرین بروزرسانی» together.
 */
export function RateLine({ compact = false }: { compact?: boolean }) {
  const rate = useAedRate();
  if (!rate) return null;

  return (
    <p className="text-[11px] leading-5 text-muted">
      <span className="font-extrabold text-ink">{formatAedRateLine(rate)}</span>
      {!compact && (
        <>
          {' · '}
          <span>
            آخرین بروزرسانی: <time dateTime={rate.updatedAt}>{updatedLabel(rate.updatedAt)}</time>
          </span>
        </>
      )}
    </p>
  );
}
