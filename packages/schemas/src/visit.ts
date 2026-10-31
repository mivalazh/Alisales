import { z } from 'zod';

/**
 * Structured visit requests inside chat (`visit_request_chat` flag).
 *
 * A buyer sends «درخواست بازدید» with an optional date and time; the seller
 * may accept that slot or propose a counter-time. Every structured message
 * also carries a human-readable body so the thread stays readable without any
 * client-side interpretation. Dates are Gregorian ISO (`YYYY-MM-DD`) and times
 * are 24-hour `HH:mm`; both always render with Latin digits.
 */

export const VISIT_REQUEST_DEFAULT_MESSAGE = 'سلام، می‌خواستم وقت بازدید بگیرم.';

export const visitSlotSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'تاریخ باید به شکل 2026-10-31 باشد' })
    .nullable()
    .default(null),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'ساعت باید به شکل 17:30 باشد' })
    .nullable()
    .default(null),
});

export type VisitSlot = z.infer<typeof visitSlotSchema>;

/** Calendar-valid date (rejects 2026-02-30) on top of the shape check. */
export function isValidVisitDate(date: string): boolean {
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export const messageKinds = ['text', 'visit_request', 'visit_accept', 'visit_counter'] as const;
export type MessageKind = (typeof messageKinds)[number];

export const MESSAGE_KIND_LABELS: Record<MessageKind, string> = {
  text: '',
  visit_request: 'درخواست بازدید',
  visit_accept: 'تأیید زمان بازدید',
  visit_counter: 'پیشنهاد زمان دیگر',
};

export function isVisitKind(kind: MessageKind): boolean {
  return kind !== 'text';
}

/** «2026-10-31 ساعت 17:30», «2026-10-31», «ساعت 17:30» or «بدون زمان مشخص». */
export function visitSlotLabel(slot: VisitSlot | null | undefined): string {
  if (!slot) return 'بدون زمان مشخص';
  if (slot.date && slot.time) return `${slot.date} ساعت ${slot.time}`;
  if (slot.date) return slot.date;
  if (slot.time) return `ساعت ${slot.time}`;
  return 'بدون زمان مشخص';
}

/** The body stored with a structured message. */
export function visitMessageBody(
  kind: Exclude<MessageKind, 'text'>,
  slot: VisitSlot | null,
): string {
  if (kind === 'visit_request') return VISIT_REQUEST_DEFAULT_MESSAGE;
  if (kind === 'visit_accept') return `زمان بازدید تأیید شد: ${visitSlotLabel(slot)}`;
  return `زمان دیگری پیشنهاد می‌کنم: ${visitSlotLabel(slot)}`;
}
