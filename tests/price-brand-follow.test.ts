import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  amountToPersianWords,
  listingPublishSchema,
  priceAmountSchema,
  tomanInWords,
  tomanToIRR,
} from '@alisales/schemas';
import { boostFollowed, followedListingCount } from '../apps/web/lib/follow-priority';
import {
  applyListingOverrides,
  removeDevListing,
  removedListingIds,
} from '../apps/web/lib/data/dev-store';
import { readJson, writeJson } from '../apps/web/lib/storage/demo-store';
import { storiesFrom } from '../apps/web/lib/stories';
import type { ListingCardData } from '../apps/web/lib/data/listings';

const ROOT = join(__dirname, '..');

function card(slug: string, sellerId: string, coverUrl: string | null = null): ListingCardData {
  return {
    id: slug,
    slug,
    sellerId,
    coverUrl,
  } as unknown as ListingCardData;
}

describe('priceAmountSchema — typed prices survive the round trip', () => {
  it('accepts a plain eleven-digit price as a string', () => {
    expect(priceAmountSchema.parse('54400000000')).toBe(54_400_000_000);
  });

  it('strips Latin and Persian thousands separators and Persian digits', () => {
    expect(priceAmountSchema.parse('54,400,000,000')).toBe(54_400_000_000);
    expect(priceAmountSchema.parse('۵۴٬۴۰۰٬۰۰۰٬۰۰۰')).toBe(54_400_000_000);
    expect(priceAmountSchema.parse(' 54 400 000 000 ')).toBe(54_400_000_000);
  });

  it('keeps numbers as numbers and rejects non-prices', () => {
    expect(priceAmountSchema.parse(544_000_000_000)).toBe(544_000_000_000);
    expect(priceAmountSchema.safeParse('').success).toBe(false);
    expect(priceAmountSchema.safeParse('0').success).toBe(false);
    expect(priceAmountSchema.safeParse('-5').success).toBe(false);
    expect(priceAmountSchema.safeParse('12.5').success).toBe(false);
    expect(priceAmountSchema.safeParse('abc').success).toBe(false);
  });

  it('accepts a 500-billion-Toman listing without overflowing', () => {
    const irr = tomanToIRR(500_000_000_000);
    expect(irr).toBe(5_000_000_000_000);
    expect(priceAmountSchema.safeParse(irr).success).toBe(true);
    expect(priceAmountSchema.safeParse(String(irr)).success).toBe(true);
  });

  it('is the field the publish schema uses', () => {
    expect(listingPublishSchema.shape.priceIRR).toBe(priceAmountSchema);
  });
});

describe('amountToPersianWords', () => {
  it('reads 54.4 billion the way the helper line prints it', () => {
    expect(amountToPersianWords(54_400_000_000)).toBe('۵۴ میلیارد و ۴۰۰ میلیون');
    expect(tomanInWords(54_400_000_000)).toBe('۵۴ میلیارد و ۴۰۰ میلیون تومان');
  });

  it('handles small, round and empty amounts', () => {
    expect(amountToPersianWords(500)).toBe('۵۰۰');
    expect(amountToPersianWords(1_000)).toBe('هزار');
    expect(amountToPersianWords(0)).toBe('');
    expect(amountToPersianWords(-10)).toBe('');
    expect(tomanInWords(Number.NaN)).toBe('');
  });
});

describe('brand box — two scrollable rows', () => {
  it('renders the grid on the brand list', () => {
    const source = readFileSync(join(ROOT, 'apps/web/components/BrandModelBox.tsx'), 'utf8');
    expect(source).toContain('grid-rows-2');
    expect(source).toContain('grid-flow-col');
    expect(source).toContain('overflow-x-auto');
    expect(source).toMatch(/auto-cols-\[\d+px\]/);
    expect(source).toContain('overscroll-x-contain');
  });
});

describe('owner deletion in demo mode', () => {
  it('tombstones a seeded listing so every feed drops it', () => {
    const id = `delete-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const listings = [{ id, slug: 'to-delete', sellerId: 'seller-a' } as unknown as ListingCardData];
    try {
      expect(applyListingOverrides(listings)).toHaveLength(1);
      removeDevListing(id);
      expect(removedListingIds()).toContain(id);
      expect(applyListingOverrides(listings)).toHaveLength(0);
    } finally {
      const rest = readJson<string[]>('deleted-listings.json', () => []).filter((x) => x !== id);
      writeJson('deleted-listings.json', rest);
    }
  });
});

describe('follow priority', () => {
  const feed = [card('a1', 'seller-a'), card('b1', 'seller-b'), card('a2', 'seller-a')];

  it('moves followed showrooms to the front, preserving order', () => {
    expect(boostFollowed(feed, ['seller-a']).map((l) => l.slug)).toEqual(['a1', 'a2', 'b1']);
  });

  it('is a no-op without follows', () => {
    expect(boostFollowed(feed, []).map((l) => l.slug)).toEqual(['a1', 'b1', 'a2']);
  });

  it('counts followed listings without reordering', () => {
    expect(followedListingCount(feed, ['seller-a'])).toBe(2);
    expect(followedListingCount(feed, [])).toBe(0);
  });

  it('puts followed sellers at the front of the story rail', () => {
    const listings = [
      card('editorial', 'seller-b', '/a.webp'),
      card('followed', 'seller-a', '/b.webp'),
      card('other', 'seller-c', '/c.webp'),
    ];
    const stories = storiesFrom(listings, [], ['editorial'], 6, ['seller-a']);
    expect(stories[0]?.slug).toBe('followed');
    expect(stories.map((s) => s.slug)).toContain('editorial');
  });
});
