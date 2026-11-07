'use client';

import { formatAedRateLine, formatJalali, toJalali, toPersianDigits } from '@alisales/schemas';
import { useAedRate } from './RateProvider';

/** «۱۴۰۵/۰۸/۱۳ · ۲۲:۴۵» — the moment the rate on screen was set, in Kish time. */
function updatedLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  // Pin the clock to Iran so the server (UTC) and the browser agree during hydration.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const jalali = toJalali(Number(get('year')), Number(get('month')), Number(get('day')));
  return `${formatJalali(jalali)} · ${toPersianDigits(`${get('hour')}:${get('minute')}`)}`;
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
