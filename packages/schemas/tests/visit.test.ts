import { describe, expect, it } from 'vitest';
import {
  MESSAGE_KIND_LABELS,
  VISIT_REQUEST_DEFAULT_MESSAGE,
  isVisitKind,
  isValidVisitDate,
  visitMessageBody,
  visitSlotLabel,
  visitSlotSchema,
} from '../src/visit';

describe('visit request wording', () => {
  it('uses the exact default request sentence', () => {
    expect(VISIT_REQUEST_DEFAULT_MESSAGE).toBe('سلام، می‌خواستم وقت بازدید بگیرم.');
    expect(visitMessageBody('visit_request', null)).toBe('سلام، می‌خواستم وقت بازدید بگیرم.');
  });

  it('describes the accepted slot', () => {
    expect(visitMessageBody('visit_accept', { date: '2026-10-31', time: '17:30' })).toBe(
      'زمان بازدید تأیید شد: 2026-10-31 ساعت 17:30',
    );
  });

  it('describes a counter-proposal', () => {
    expect(visitMessageBody('visit_counter', { date: null, time: '09:00' })).toContain(
      'ساعت 09:00',
    );
  });

  it('labels structured message kinds', () => {
    expect(MESSAGE_KIND_LABELS.visit_request).toBe('درخواست بازدید');
    expect(MESSAGE_KIND_LABELS.visit_accept).toBe('تأیید زمان بازدید');
    expect(MESSAGE_KIND_LABELS.visit_counter).toBe('پیشنهاد زمان دیگر');
    expect(isVisitKind('text')).toBe(false);
    expect(isVisitKind('visit_request')).toBe(true);
  });
});

describe('visitSlotLabel', () => {
  it('renders both parts with Latin digits', () => {
    expect(visitSlotLabel({ date: '2026-10-31', time: '17:30' })).toBe(
      '2026-10-31 ساعت 17:30',
    );
  });

  it('handles partial and empty slots', () => {
    expect(visitSlotLabel({ date: '2026-10-31', time: null })).toBe('2026-10-31');
    expect(visitSlotLabel({ date: null, time: '08:15' })).toBe('ساعت 08:15');
    expect(visitSlotLabel({ date: null, time: null })).toBe('بدون زمان مشخص');
    expect(visitSlotLabel(null)).toBe('بدون زمان مشخص');
  });
});

describe('visitSlotSchema', () => {
  it('accepts a full slot', () => {
    expect(visitSlotSchema.parse({ date: '2026-03-01', time: '18:45' })).toEqual({
      date: '2026-03-01',
      time: '18:45',
    });
  });

  it('defaults missing fields to null (date/time are optional)', () => {
    expect(visitSlotSchema.parse({})).toEqual({ date: null, time: null });
  });

  it('rejects a malformed date or time', () => {
    expect(visitSlotSchema.safeParse({ date: '31/10/2026' }).success).toBe(false);
    expect(visitSlotSchema.safeParse({ time: '24:00' }).success).toBe(false);
    expect(visitSlotSchema.safeParse({ time: '7:5' }).success).toBe(false);
  });

  it('validates real calendar dates', () => {
    expect(isValidVisitDate('2026-02-28')).toBe(true);
    expect(isValidVisitDate('2026-02-30')).toBe(false);
    expect(isValidVisitDate('2026-13-01')).toBe(false);
  });
});
