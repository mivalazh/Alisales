import { describe, expect, it } from 'vitest';
import {
  MAX_PHOTOS,
  canTransition,
  isSlotState,
  listingDraftSchema,
  listingPublishSchema,
  listingStates,
} from '../src/listing';
import { plateSectionKey, plateStatement, PLATE_DECLARATION_FOOTER } from '../src/legal';

const baseVehicle = {
  brand: 'saipa',
  model: 'کوییک',
  trim: null,
  year: 1402,
  mileageKm: 45_000,
  gearbox: 'manual',
  fuel: 'petrol',
  color: 'white',
  condition: 'used',
  plateType: 'standard',
  vin: null,
} as const;

const photo = (position: number) => ({
  path: `u/l/${position}.webp`,
  mime: 'image/webp',
  bytes: 200_000,
  width: 1600,
  height: 1200,
  position,
});

const baseDraft = {
  vehicle: baseVehicle,
  priceIRR: 900_000_000_000,
  city: 'kish',
  description: 'خودرو سالم، تک‌پلاک، قابل معاوضه با مشورت.',
  photos: [photo(0)],
  showroomId: null,
  allowPhoneReveal: false,
};

describe('listing draft schema', () => {
  it('accepts a valid draft', () => {
    expect(listingDraftSchema.safeParse(baseDraft).success).toBe(true);
  });

  it('rejects more than 20 photos', () => {
    const many = { ...baseDraft, photos: Array.from({ length: MAX_PHOTOS + 1 }, (_, i) => photo(i)) };
    expect(listingDraftSchema.safeParse(many).success).toBe(false);
  });

  it('rejects duplicate photo positions', () => {
    const dup = { ...baseDraft, photos: [photo(0), photo(0)] };
    expect(listingDraftSchema.safeParse(dup).success).toBe(false);
  });

  it('rejects non-webp/jpeg/png mimes and oversized files', () => {
    const badMime = { ...baseDraft, photos: [{ ...photo(0), mime: 'image/gif' }] };
    expect(listingDraftSchema.safeParse(badMime).success).toBe(false);
    const tooBig = { ...baseDraft, photos: [{ ...photo(0), bytes: 9 * 1024 * 1024 }] };
    expect(listingDraftSchema.safeParse(tooBig).success).toBe(false);
  });

  it('rejects out-of-range Jalali years and non-int prices', () => {
    const badYear = { ...baseDraft, vehicle: { ...baseVehicle, year: 1200 } };
    expect(listingDraftSchema.safeParse(badYear).success).toBe(false);
    const badPrice = { ...baseDraft, priceIRR: 1.5 };
    expect(listingDraftSchema.safeParse(badPrice).success).toBe(false);
  });
});

describe('listing publish schema', () => {
  it('requires at least one photo', () => {
    expect(listingPublishSchema.safeParse({ ...baseDraft, photos: [] }).success).toBe(false);
  });

  it('requires a description of at least 20 chars', () => {
    expect(listingPublishSchema.safeParse({ ...baseDraft, description: 'کوتاه' }).success).toBe(false);
    expect(listingPublishSchema.safeParse(baseDraft).success).toBe(true);
  });
});

describe('state machine', () => {
  it('covers every declared state', () => {
    for (const s of listingStates) expect(listingTransitionsGuard(s));
  });

  it('lets an owner move draft → pending_review but not draft → active', () => {
    expect(canTransition('draft', 'pending_review', 'owner')).toBe(true);
    expect(canTransition('draft', 'active', 'owner')).toBe(false);
  });

  it('lets an owner pause and sell an active listing', () => {
    expect(canTransition('active', 'paused', 'owner')).toBe(true);
    expect(canTransition('active', 'sold', 'owner')).toBe(true);
    expect(canTransition('active', 'expired', 'owner')).toBe(true);
  });

  it('lets the owner reactivate a sold listing, and only back to active', () => {
    // Reactivation rule (Phase 2 / D2): sold stays in the catalog with its
    // sold position; the owner may bring it back to active.
    expect(canTransition('sold', 'active', 'owner')).toBe(true);
    expect(canTransition('sold', 'paused', 'owner')).toBe(false);
    expect(canTransition('sold', 'draft', 'owner')).toBe(false);
    expect(canTransition('sold', 'active', 'admin')).toBe(true);
  });

  it('admins and the system can move any state to any other state', () => {
    expect(canTransition('active', 'rejected', 'admin')).toBe(true);
    expect(canTransition('active', 'expired', 'system')).toBe(true);
    expect(canTransition('sold', 'active', 'system')).toBe(true);
  });

  it('slot states are draft/pending/active/paused (sold/expired/rejected free the slot)', () => {
    const slotStates = ['draft', 'pending_review', 'active', 'paused'] as const;
    const terminalStates = ['sold', 'expired', 'rejected'] as const;
    expect(slotStates.every(isSlotState)).toBe(true);
    expect(terminalStates.some(isSlotState)).toBe(false);
  });
});

function listingTransitionsGuard(s: string) {
  expect(listingStates).toContain(s);
}

describe('plate sections (seller-declared, no platform disclaimer)', () => {
  it('gives Kish and transit/un-plated their own distinct sections', () => {
    expect(plateSectionKey('kish')).toBe('kish');
    expect(plateSectionKey('temporary_transit')).toBe('temporary_or_unplated');
    expect(plateSectionKey('unplated')).toBe('temporary_or_unplated');
    expect(plateSectionKey('standard')).toBeNull();
  });

  it('uses seller-declared wording only (no mandated inspection warning)', () => {
    const statement = plateStatement('kish')!;
    expect(statement).toContain('فروشنده');
    expect(statement).toMatch(/اعلام کرده است/);
    // No forced legal/inspection language
    expect(statement).not.toMatch(/مراجع ذیصلاح|استعلام|مسئولیت/);
    expect(PLATE_DECLARATION_FOOTER).not.toMatch(/مراجع ذیصلاح|پلیس/);
    expect(plateStatement('standard')).toBeNull();
  });
});
