import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { issueToPersian } from '../src/errors';
import { listingPublishSchema } from '../src/listing';
import { searchFiltersSchema } from '../src/filters';

const base = {
  vehicle: {
    brand: 'saipa',
    model: 'کوییک',
    trim: null,
    year: 1402,
    mileageKm: 1000,
    gearbox: 'manual',
    fuel: 'petrol',
    color: 'white',
    condition: 'used',
    plateType: 'standard',
    vin: null,
  },
  priceIRR: 900_000_000_000,
  city: 'kish',
  description: 'توضیحات کامل و معتبر برای انتشار آگهی خودرو.',
  photos: [{ path: 'u/l/0.webp', mime: 'image/webp', bytes: 1000, width: 4, height: 3, position: 0 }],
  showroomId: null,
  allowPhoneReveal: false,
};

describe('Persian validation messages (Zod error map)', () => {
  it('translates bound violations', () => {
    const r = z.string().min(5).safeParse('abc');
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0]?.message).toContain('نویسه');
  });

  it('translates type errors', () => {
    const r = z.number().safeParse('abc');
    expect(!r.success && r.error.issues[0]?.message).toContain('نوع مقدار');
  });

  it('translates enum/option errors', () => {
    const r = searchFiltersSchema.safeParse({ gearbox: ['teleport'] });
    expect(!r.success && r.error.issues[0]?.message).toContain('گزینه‌های مجاز');
  });

  it('keeps custom Persian refinement messages intact', () => {
    const noPhoto = listingPublishSchema.safeParse({ ...base, photos: [] });
    expect(!noPhoto.success && noPhoto.error.issues[0]?.message).toBe(
      'برای انتشار آگهی حداقل یک عکس لازم است',
    );

    const dup = listingPublishSchema.safeParse({
      ...base,
      photos: [...base.photos, { ...base.photos[0]!, path: 'u/l/0b.webp' }],
    });
    expect(!dup.success && dup.error.issues[0]?.message).toBe('موقعیت تکراری عکس');
  });

  it('falls back to Persian for unknown issue codes', () => {
    expect(issueToPersian({ code: 'something_brand_new' })).toBe('اطلاعات واردشده معتبر نیست.');
    expect(issueToPersian({ code: 'custom' })).toBeUndefined();
  });

  it('formats numeric bounds with Persian digits', () => {
    const r = z.number().max(2_000_000).safeParse(3_000_000);
    expect(!r.success && r.error.issues[0]?.message).toContain('۲٬۰۰۰٬۰۰۰');
  });
});
