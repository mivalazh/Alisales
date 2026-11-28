import type { TicketStatus } from './types';

export const STATUS_LABEL: Record<TicketStatus, { fa: string; en: string }> = {
  open: { fa: 'باز', en: 'Open' },
  pending: { fa: 'در حال بررسی', en: 'Under review' },
  answered: { fa: 'پاسخ داده شد', en: 'Answered' },
  closed: { fa: 'بسته شده', en: 'Closed' },
};

/** Crisp status pills: neutral, amber, emerald, muted — never a blue chip. */
export const STATUS_PILL: Record<TicketStatus, string> = {
  open: 'bg-[#111144]/8 text-[#111144] dark:bg-white/10 dark:text-[#F4F1EC]',
  pending:
    'bg-[#F98513]/15 text-[#B45309] dark:bg-[#F98513]/20 dark:text-[#F98513]',
  answered:
    'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  closed: 'bg-sunken text-muted dark:bg-white/10',
};

/** Wire values arrive as plain JSON: anything that is not a known status reads as «در حال بررسی». */
export function toTicketStatus(value: unknown): TicketStatus {
  return typeof value === 'string' && Object.hasOwn(STATUS_LABEL, value)
    ? (value as TicketStatus)
    : 'pending';
}

export function statusLabel(status: TicketStatus, lang: 'fa' | 'en'): string {
  return STATUS_LABEL[status]?.[lang] ?? status;
}

/** Latin-digit, locale-stable timestamp («28 Nov 2026, 14:05»). */
export function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** Short relative age for the inbox rows — always Latin digits. */
export function relativeAge(iso: string, lang: 'fa' | 'en'): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60_000));
  if (minutes < 1) return lang === 'en' ? 'now' : 'همین حالا';
  if (minutes < 60) return lang === 'en' ? `${minutes}m` : `${minutes} دقیقه`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return lang === 'en' ? `${hours}h` : `${hours} ساعت`;
  const days = Math.round(hours / 24);
  return lang === 'en' ? `${days}d` : `${days} روز`;
}
