import { describe, expect, it } from 'vitest';
import {
  PART_CATEGORY_LABELS,
  PART_COMPATIBILITY_GENERAL,
  PART_CONDITION_LABELS,
  PART_ORIGIN_LABELS,
  compatibilityLabel,
  partListingPublishSchema,
} from '../src/parts';

const photo = {
  path: 'pending/part-0.webp',
  mime: 'image/webp' as const,
  bytes: 1024,
  width: 800,
  height: 600,
  position: 0,
};

const base = {
  kind: 'part' as const,
  category: 'brake' as const,
  title: 'دیسک ترمز جلو پژو 206',
  origin: 'original' as const,
  condition: 'new' as const,
  priceIRR: 4_500_000,
  city: 'kish',
  description: 'دیسک ترمز نو و سالم، مناسب پژو 206 تیپ 2.',
  photos: [photo],
};

describe('parts labels', () => {
  it('has Persian labels for every category', () => {
    expect(PART_CATEGORY_LABELS.brake).toBe('ترمز و تعلیق');
    expect(PART_CATEGORY_LABELS.engine_battery).toBe('موتور و باتری');
    expect(PART_CATEGORY_LABELS.engine).toBe('گیربکس و کلاچ');
    expect(PART_CATEGORY_LABELS.body).toBe('بدنه و چراغ');
    expect(PART_CATEGORY_LABELS.other).toBe('لوازم جانبی');
    expect(Object.keys(PART_CATEGORY_LABELS)).toHaveLength(9);
  });

  it('maps authenticity and condition to the split selector labels', () => {
    expect(PART_ORIGIN_LABELS).toEqual({
      original: 'اورجینال (اصلی / OEM)',
      stock: 'استوک',
      commercial: 'تجاری (تایوانی/چینی)',
      unknown: 'نامشخص',
    });
    expect(PART_CONDITION_LABELS).toEqual({
      new: 'نو / آکبند',
      stock: 'استوک (اصلی وارداتی)',
      used: 'کارکرده',
    });
  });
});

describe('compatibilityLabel', () => {
  it('defaults to سازگاری عمومی', () => {
    expect(PART_COMPATIBILITY_GENERAL).toBe('سازگاری عمومی');
    expect(compatibilityLabel(null)).toBe('سازگاری عمومی');
    expect(compatibilityLabel('   ')).toBe('سازگاری عمومی');
    expect(compatibilityLabel('پژو 206 و 207')).toBe('پژو 206 و 207');
  });
});

describe('partListingPublishSchema', () => {
  it('accepts a minimal valid part and defaults the optional fields', () => {
    const parsed = partListingPublishSchema.parse(base);
    expect(parsed.partNumber).toBeNull();
    expect(parsed.compatibility).toBeNull();
    expect(parsed.originCountry).toBeNull();
    expect(parsed.warranty).toBeNull();
    expect(parsed.showroomId).toBeNull();
    expect(parsed.allowPhoneReveal).toBe(true);
  });

  it('keeps optional part number, compatibility and warranty when sent', () => {
    const parsed = partListingPublishSchema.parse({
      ...base,
      partNumber: 'AB-1234',
      compatibility: 'پژو 206 تیپ 2',
      warranty: '6 ماه',
    });
    expect(parsed.partNumber).toBe('AB-1234');
    expect(parsed.compatibility).toBe('پژو 206 تیپ 2');
    expect(parsed.warranty).toBe('6 ماه');
  });

  it('accepts the imported-stock condition as its own state', () => {
    const parsed = partListingPublishSchema.parse({ ...base, condition: 'stock' });
    expect(parsed.condition).toBe('stock');
  });

  it('rejects an unknown category, origin or condition', () => {
    expect(partListingPublishSchema.safeParse({ ...base, category: 'spaceship' }).success).toBe(false);
    expect(partListingPublishSchema.safeParse({ ...base, origin: 'fake' }).success).toBe(false);
    expect(partListingPublishSchema.safeParse({ ...base, condition: 'broken' }).success).toBe(false);
  });

  it('rejects a title shorter than three characters', () => {
    expect(partListingPublishSchema.safeParse({ ...base, title: 'دی' }).success).toBe(false);
  });

  it('publishes without photos (the API assigns a default cover)', () => {
    expect(partListingPublishSchema.safeParse({ ...base, photos: [] }).success).toBe(true);
  });

  it('accepts a short or empty description', () => {
    // Descriptions are optional for parts too — no minimum length.
    expect(partListingPublishSchema.safeParse({ ...base, description: 'کوتاه' }).success).toBe(true);
    expect(partListingPublishSchema.safeParse({ ...base, description: '' }).success).toBe(true);
  });

  it('only accepts the part kind', () => {
    expect(partListingPublishSchema.safeParse({ ...base, kind: 'vehicle' }).success).toBe(false);
  });
});
