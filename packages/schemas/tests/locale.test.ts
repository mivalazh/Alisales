import { describe, expect, it } from 'vitest';
import {
  formatIRR,
  formatJalali,
  formatJalaliDate,
  groupDigits,
  jalaliOf,
  toJalali,
  toPersianDigits,
} from '../src/locale';

describe('toPersianDigits / groupDigits', () => {
  it('maps ASCII digits to Persian digits', () => {
    expect(toPersianDigits('1402')).toBe('۱۴۰۲');
    expect(toPersianDigits('پلاک ۱۲B34')).toBe('پلاک ۱۲B۳۴');
    expect(toPersianDigits(900000)).toBe('۹۰۰۰۰۰');
  });

  it('groups integers by three with the Persian separator', () => {
    expect(groupDigits(0)).toBe('0');
    expect(groupDigits(999)).toBe('999');
    expect(groupDigits(1_100_000_000_000)).toBe('1٬100٬000٬000٬000');
    expect(groupDigits(700_000_000_000)).toBe('700٬000٬000٬000');
  });
});

describe('formatIRR', () => {
  it('formats rial amounts with Persian digits and unit', () => {
    expect(formatIRR(1_100_000_000_000)).toBe('۱٬۱۰۰٬۰۰۰٬۰۰۰٬۰۰۰ ریال');
    expect(formatIRR(8_000_000)).toBe('۸٬۰۰۰٬۰۰۰ ریال');
    expect(formatIRR(0)).toBe('۰ ریال');
  });
});

describe('toJalali', () => {
  it('converts known anchor dates', () => {
    expect(toJalali(2000, 1, 1)).toEqual({ jy: 1378, jm: 10, jd: 11 }); // ۱۱ دی ۱۳۷۸
    expect(toJalali(2024, 3, 20)).toEqual({ jy: 1403, jm: 1, jd: 1 }); // Nowruz 1403
    expect(toJalali(2026, 10, 21)).toEqual(jalaliOf(new Date(2026, 9, 21)));
  });

  it('agrees with the ICU Persian calendar across 45 years', () => {
    // Node ships full ICU; fa-IR-u-ca-persian is the reference implementation.
    const fmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const toAscii = (s: string) => s.replace(/[۰-۹]/g, (d) =>
      String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

    // Every 13 days from 1995-01-01 to 2039-12-31 — 1240 samples.
    const start = Date.UTC(1995, 0, 1);
    const end = Date.UTC(2039, 11, 31);
    let samples = 0;
    for (let t = start; t <= end; t += 13 * 86_400_000) {
      const d = new Date(t);
      const { jy, jm, jd } = toJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      const parts = fmt.formatToParts(d);
      const icu = {
        jy: Number(toAscii(parts.find((p) => p.type === 'year')!.value)),
        jm: Number(toAscii(parts.find((p) => p.type === 'month')!.value)),
        jd: Number(toAscii(parts.find((p) => p.type === 'day')!.value)),
      };
      expect({ jy, jm, jd }).toEqual(icu);
      samples++;
    }
    expect(samples).toBeGreaterThan(1200);
  });
});

describe('formatJalali / formatJalaliDate', () => {
  it('zero-pads and renders Persian digits', () => {
    expect(formatJalali({ jy: 1378, jm: 10, jd: 11 })).toBe('۱۳۷۸/۱۰/۱۱');
    expect(formatJalaliDate(new Date(2000, 0, 1))).toBe('۱۳۷۸/۱۰/۱۱');
    expect(formatJalaliDate(new Date(2026, 9, 21))).toBe('۱۴۰۵/۰۷/۲۹');
  });
});
