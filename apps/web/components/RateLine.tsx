'use client';

import {
  aedToToman,
  formatAedRateLine,
  formatJalali,
  toJalali,
  toPersianDigits,
} from '@alisales/schemas';
import { useI18n } from '@/lib/i18n';
import { useAedRate } from './RateProvider';

/** «۱۴۰۵/۰۸/۱۳ · ۲۲:۴۵» — the moment the rate on screen was set, in Kish time. */
function updatedLabel(iso: string, english: boolean): string {
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
  if (english) {
    return `${get('day')} ${new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(date)} ${get('year')} · ${get('hour')}:${get('minute')}`;
  }
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
  const { t, lang } = useI18n();
  if (!rate) return null;

  const english = lang === 'en';
  const rateLabel = english
    ? `1 AED ≈ ${new Intl.NumberFormat('en-US').format(aedToToman(rate.aedToIrr))} Toman`
    : formatAedRateLine(rate);

  return (
    <p className="text-[11px] leading-5 text-muted">
      <span className="font-extrabold text-ink">{rateLabel}</span>
      {!compact && (
        <>
          {' · '}
          <span>
            {t('آخرین بروزرسانی', 'Last updated')}:{' '}
            <time dateTime={rate.updatedAt}>{updatedLabel(rate.updatedAt, english)}</time>
          </span>
        </>
      )}
    </p>
  );
}
