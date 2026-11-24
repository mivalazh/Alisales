import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb } from './helpers/pg';

/**
 * 0020's keyset page against the same database the parity suite uses.
 *
 * `search_listings` (0017) stays the definition of "the matching set": a walk
 * through `search_listings_page` must visit exactly those rows, in exactly that
 * order, with no repeats and no gaps — that is the property OFFSET paging breaks
 * when a listing is published between two pages, and the property a cursor has
 * to preserve instead.
 *
 * Also pinned here: `limit + 1` is how the function knows there is another page
 * (a full last page must not advertise one), and a cursor is bound to the
 * filter set it was minted for.
 */

let db: PGlite;

beforeAll(async () => {
  db = await createDb();
}, 60_000);

afterAll(async () => {
  await db?.close();
});

interface Envelope {
  rows: Array<{ id: string }>;
  next_cursor: string | null;
}

async function page(
  filters: Record<string, unknown>,
  limit: number,
  cursor: string | null = null,
): Promise<Envelope> {
  const { rows } = await db.query<{ rows: unknown; next_cursor: string | null }>(
    'select rows, next_cursor from public.search_listings_page($1::jsonb, $2, $3)',
    [JSON.stringify(filters), limit, cursor],
  );
  const envelope = rows[0]!;
  const parsed = typeof envelope.rows === 'string' ? JSON.parse(envelope.rows) : envelope.rows;
  return { rows: (parsed ?? []) as Envelope['rows'], next_cursor: envelope.next_cursor };
}

/** The full matching set and order, from the function this one must mirror. */
async function full(filters: Record<string, unknown>, limit = 100): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>(
    'select id from public.search_listings($1::jsonb, $2, 0)',
    [JSON.stringify(filters), limit],
  );
  return rows.map((row) => row.id);
}

/** Walks every page and returns the ids in visit order plus the page count. */
async function walk(filters: Record<string, unknown>, limit: number) {
  const ids: string[] = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    const result = await page(filters, limit, cursor);
    ids.push(...result.rows.map((row) => row.id));
    cursor = result.next_cursor;
    pages += 1;
    if (pages > 100) throw new Error('pagination did not terminate');
  } while (cursor);
  return { ids, pages };
}

describe('search_listings_page', () => {
  it('walks the matching set in the search_listings order, without gaps or repeats', async () => {
    const expected = await full({});
    expect(expected.length).toBeGreaterThan(3);

    const { ids, pages } = await walk({}, 3);

    expect(pages).toBeGreaterThan(1);
    expect(ids).toEqual(expected);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('honours a filter the same way the unpaged read does', async () => {
    const filters = { category: 'car', kishOnly: true };
    const expected = await full(filters);

    expect((await walk(filters, 2)).ids).toEqual(expected);
  });

  it('advertises a next page only when a row follows the page', async () => {
    const total = (await full({})).length;

    // Exactly one page of everything: the extra row does not exist, so no cursor.
    const exact = await page({}, total);
    expect(exact.rows).toHaveLength(total);
    expect(exact.next_cursor).toBeNull();

    // One row short: the limit+1 row is the proof that another page exists.
    const short = await page({}, total - 1);
    expect(short.rows).toHaveLength(total - 1);
    expect(short.next_cursor).toBeTruthy();
  });

  it('returns an empty page and no cursor when nothing matches', async () => {
    const result = await page({ brand: 'no-such-brand' }, 10);

    expect(result.rows).toEqual([]);
    expect(result.next_cursor).toBeNull();
  });

  it('rejects a cursor minted for a different filter set', async () => {
    const first = await page({}, 1);
    expect(first.next_cursor).toBeTruthy();

    await expect(page({ brand: 'toyota' }, 1, first.next_cursor)).rejects.toThrow(
      /does not belong to this filter set/,
    );
  });

  it('clamps the page size and rejects a malformed cursor', async () => {
    const clamped = await page({}, 5_000);
    expect(clamped.rows.length).toBeLessThanOrEqual(100);

    await expect(page({}, 5, 'not-base64-at-all')).rejects.toThrow(/malformed pagination cursor/);
  });
});
