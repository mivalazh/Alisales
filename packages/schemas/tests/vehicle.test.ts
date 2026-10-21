import { describe, expect, it } from 'vitest';
import { listingDraftSchema } from '../src/listing';

const vehicle = {
  brand: 'ikco',
  model: 'پژو ۲۰۶',
  trim: null,
  year: 1398,
  mileageKm: 120_000,
  gearbox: 'manual',
  fuel: 'petrol',
  color: 'silver',
  condition: 'used',
  plateType: 'kish',
  vin: null,
} as const;

describe('vehicle validation used by listing forms', () => {
  it('accepts Kish and unplated declarations without any disclaimer flag', () => {
    for (const plateType of ['kish', 'temporary_transit', 'unplated'] as const) {
      const res = listingDraftSchema.safeParse({
        vehicle: { ...vehicle, plateType },
        priceIRR: 1_000_000_000_000,
        city: 'kish',
        description: 'توضیحات کامل خودرو برای انتشار آگهی.',
        photos: [{ path: 'a/b/0.webp', mime: 'image/webp', bytes: 1000, width: 4, height: 3, position: 0 }],
        showroomId: null,
        allowPhoneReveal: false,
      });
      expect(res.success, plateType).toBe(true);
      expect(res.success && 'plateDeclarationAck' in res.data).toBe(false);
    }
  });

  it('rejects malformed VINs', () => {
    const res = listingDraftSchema.safeParse({
      vehicle: { ...vehicle, vin: 'TOO-SHORT' },
      priceIRR: 1,
      city: 'kish',
      description: 'x',
      photos: [],
      showroomId: null,
      allowPhoneReveal: false,
    });
    expect(res.success).toBe(false);
  });

  it('rejects unknown brands', () => {
    const res = listingDraftSchema.safeParse({
      vehicle: { ...vehicle, brand: 'ferrari' },
      priceIRR: 1,
      city: 'kish',
      description: 'x',
      photos: [],
      showroomId: null,
      allowPhoneReveal: false,
    });
    expect(res.success).toBe(false);
  });
});
