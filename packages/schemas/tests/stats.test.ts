import { describe, expect, it } from 'vitest';
import { summarizeOwnerStats, totalOwnerStats } from '../src/stats';

describe('summarizeOwnerStats — views', () => {
  it('counts one view per viewer per listing', () => {
    const rows = summarizeOwnerStats({
      listingIds: ['a'],
      views: [
        { listingId: 'a', viewerId: 'u1' },
        { listingId: 'a', viewerId: 'u1' },
        { listingId: 'a', viewerId: 'u2' },
      ],
    });
    expect(rows[0]!.views).toBe(2);
  });

  it('keeps listings separate', () => {
    const rows = summarizeOwnerStats({
      listingIds: ['a', 'b'],
      views: [
        { listingId: 'a', viewerId: 'u1' },
        { listingId: 'b', viewerId: 'u1' },
        { listingId: 'b', viewerId: 'u2' },
      ],
    });
    expect(rows.map((r) => r.views)).toEqual([1, 2]);
  });
});

describe('summarizeOwnerStats — the two contact counters stay separate', () => {
  it('counts every phone reveal and every new conversation independently', () => {
    const rows = summarizeOwnerStats({
      listingIds: ['a'],
      reveals: [
        { listingId: 'a' },
        { listingId: 'a' },
        { listingId: 'a' },
      ],
      conversations: [{ listingId: 'a' }],
    });
    expect(rows[0]!.phoneReveals).toBe(3);
    expect(rows[0]!.chatStarts).toBe(1);
  });

  it('never adds the two counters into one number', () => {
    const row = summarizeOwnerStats({
      listingIds: ['a'],
      reveals: [{ listingId: 'a' }, { listingId: 'a' }],
      conversations: [{ listingId: 'a' }],
    })[0]!;
    expect(Object.keys(row).sort()).toEqual(
      ['chatStarts', 'favorites', 'listingId', 'phoneReveals', 'views'].sort(),
    );
    expect(row.phoneReveals + row.chatStarts).toBe(3);
    expect(row).not.toHaveProperty('contacts');
  });
});

describe('summarizeOwnerStats — favorites', () => {
  it('counts current savers once each', () => {
    const rows = summarizeOwnerStats({
      listingIds: ['a'],
      favorites: [
        { listingId: 'a', userId: 'u1' },
        { listingId: 'a', userId: 'u2' },
        { listingId: 'a', userId: 'u1' },
      ],
    });
    expect(rows[0]!.favorites).toBe(2);
  });

  it('does not count a favorite on another listing', () => {
    const rows = summarizeOwnerStats({
      listingIds: ['a'],
      favorites: [{ listingId: 'b', userId: 'u1' }],
    });
    expect(rows[0]!.favorites).toBe(0);
  });
});

describe('summarizeOwnerStats — shape', () => {
  it('lists a requested listing with zeros when it has no events', () => {
    const rows = summarizeOwnerStats({ listingIds: ['quiet'] });
    expect(rows).toEqual([
      { listingId: 'quiet', views: 0, chatStarts: 0, phoneReveals: 0, favorites: 0 },
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(summarizeOwnerStats({})).toEqual([]);
  });

  it('keeps the caller-provided listing order', () => {
    const rows = summarizeOwnerStats({
      listingIds: ['b', 'a'],
      views: [{ listingId: 'a', viewerId: 'u1' }],
    });
    expect(rows.map((r) => r.listingId)).toEqual(['b', 'a']);
  });
});

describe('totalOwnerStats', () => {
  it('sums every counter across listings, keeping contacts split', () => {
    const totals = totalOwnerStats([
      { listingId: 'a', views: 2, chatStarts: 1, phoneReveals: 4, favorites: 3 },
      { listingId: 'b', views: 5, chatStarts: 0, phoneReveals: 1, favorites: 0 },
    ]);
    expect(totals).toEqual({ views: 7, chatStarts: 1, phoneReveals: 5, favorites: 3 });
  });

  it('returns zeros for no listings', () => {
    expect(totalOwnerStats([])).toEqual({ views: 0, chatStarts: 0, phoneReveals: 0, favorites: 0 });
  });
});
