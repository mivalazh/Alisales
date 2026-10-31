import { describe, expect, it } from 'vitest';
import {
  postingAgeDays,
  postingAgeLabel,
  tehranDayIndex,
  TEHRAN_OFFSET_MS,
} from '../src/posting-age';

const DAY_MS = 86_400_000;

/** An instant expressed as a Tehran wall-clock time (fixed +03:30). */
function atTehran(y: number, m: number, d: number, h = 0, min = 0, s = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h, min, s) - TEHRAN_OFFSET_MS);
}

const NOW = atTehran(2026, 10, 29, 12, 0);

describe('tehranDayIndex', () => {
  it('changes exactly at Tehran midnight', () => {
    const before = atTehran(2026, 10, 29, 23, 59, 59);
    const after = atTehran(2026, 10, 30, 0, 0, 0);
    expect(tehranDayIndex(after) - tehranDayIndex(before)).toBe(1);
  });

  it('is not the UTC day number', () => {
    // 21:00Z on Oct 28 is already 00:30 on Oct 29 in Tehran.
    const instant = new Date(Date.UTC(2026, 9, 28, 21, 0));
    expect(tehranDayIndex(instant)).toBe(tehranDayIndex(atTehran(2026, 10, 29, 0, 30)));
    expect(Math.floor(instant.getTime() / DAY_MS)).not.toBe(tehranDayIndex(instant));
  });

  it('accepts Date, epoch ms and ISO strings equivalently', () => {
    const d = new Date(Date.UTC(2026, 9, 29, 6, 0));
    expect(tehranDayIndex(d.toISOString())).toBe(tehranDayIndex(d.getTime()));
    expect(tehranDayIndex(d)).toBe(tehranDayIndex(d.getTime()));
  });

  it('rejects an unparsable date instead of guessing', () => {
    expect(() => postingAgeLabel('not-a-date')).toThrow(RangeError);
  });
});

describe('postingAgeDays', () => {
  it('counts Tehran calendar days, not elapsed hours', () => {
    // 20 minutes apart, but a Tehran midnight sits between them.
    expect(postingAgeDays(atTehran(2026, 10, 28, 23, 50), atTehran(2026, 10, 29, 0, 10))).toBe(1);
    // 23h45m apart within the same Tehran day.
    expect(postingAgeDays(atTehran(2026, 10, 29, 0, 5), atTehran(2026, 10, 29, 23, 50))).toBe(0);
  });

  it('never goes negative for a future timestamp (clock skew)', () => {
    expect(postingAgeDays(atTehran(2026, 10, 30, 9, 0), NOW)).toBe(0);
  });
});

describe('postingAgeLabel — bucket boundaries', () => {
  const cases: Array<[number, string]> = [
    [0, 'امروز'],
    [1, 'دیروز'],
    [2, '2 روز پیش'],
    [3, '3 روز پیش'],
    [6, '6 روز پیش'],
    [7, 'یک هفته پیش'],
    [13, 'یک هفته پیش'],
    [14, '2 هفته پیش'],
    [20, '2 هفته پیش'],
    [21, '3 هفته پیش'],
    [27, '3 هفته پیش'],
    [28, 'یک ماه پیش'],
    [59, 'یک ماه پیش'],
    [60, '2 ماه پیش'],
    [89, '2 ماه پیش'],
    [90, '3 ماه پیش'],
    [120, '4 ماه پیش'],
    [300, '10 ماه پیش'],
    [359, '11 ماه پیش'],
    [360, 'بیش از یک سال پیش'],
    [730, 'بیش از یک سال پیش'],
  ];

  it.each(cases)('%i days → %s', (days, label) => {
    const published = atTehran(2026, 10, 29 - days, 8, 0);
    expect(postingAgeLabel(published, NOW)).toBe(label);
  });

  it('uses Western digits only — no Persian numerals, no hours', () => {
    const published = atTehran(2026, 10, 26, 8, 0);
    const label = postingAgeLabel(published, NOW);
    expect(label).toBe('3 روز پیش');
    expect(label).toMatch(/^[0-9]+ روز پیش$/u);
    expect(label).not.toMatch(/[۰-۹]/u);
    expect(label).not.toMatch(/ساعت|دقیقه/u);
  });

  it('flips to دیروز across Tehran midnight, not after 24 hours', () => {
    expect(postingAgeLabel(atTehran(2026, 10, 28, 23, 50), atTehran(2026, 10, 29, 0, 10))).toBe(
      'دیروز',
    );
  });

  it('reads امروز late in the same Tehran day even when UTC says otherwise', () => {
    // Published 21:00Z Oct 28 (00:30 Tehran Oct 29); now 20:00Z Oct 29 (23:30 Tehran Oct 29).
    const published = new Date(Date.UTC(2026, 9, 28, 21, 0));
    const now = new Date(Date.UTC(2026, 9, 29, 20, 0));
    expect(postingAgeLabel(published, now)).toBe('امروز');
  });

  it('crosses the Jalali new year without a gap or repeat', () => {
    // Nowruz 1406 ≈ 2027-03-21.
    expect(postingAgeLabel(atTehran(2027, 3, 20, 23, 0), atTehran(2027, 3, 21, 1, 0))).toBe('دیروز');
    expect(postingAgeLabel(atTehran(2027, 3, 21, 1, 0), atTehran(2027, 3, 21, 23, 0))).toBe('امروز');
  });

  it('depends only on the publication instant (edits never shift the age)', () => {
    const published = atTehran(2026, 10, 29 - 40, 9, 0);
    const first = postingAgeLabel(published, NOW);
    const later = postingAgeLabel(published, NOW);
    expect(first).toBe('یک ماه پیش');
    expect(later).toBe(first);
  });
});

