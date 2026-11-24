import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BODY_TYPE_HINTS, inferBodyType } from '@alisales/schemas';

/**
 * The newest migration that writes `vehicles.body_type` from the model, because
 * the SQL search filters on that column while the browser infers the class on
 * the fly. Both sides must use the same keywords in the same order (first match
 * wins), or a car can render as an SUV in the UI and be invisible to
 * `/cars?bodyType=suv` in the hosted catalogue. This is the one guard for that
 * pairing.
 *
 * 0016 is applied history — `supabase db push` will never run it again — so the
 * comparison follows the latest backfill instead: 0022 repairs the rows 0016
 * wrote with the retired «500» / «ram» keywords and re-infers with the current
 * table. When another keyword changes, write another repair migration and point
 * this file at it; do not edit 0016 or 0022.
 */
const BACKFILL_SQL = readFileSync(
  fileURLToPath(
    new URL('../supabase/migrations/0022_body_type_keyword_repair.sql', import.meta.url),
  ),
  'utf8',
);

/** The frozen 0016 table, kept only to show what the repair moved away from. */
const APPLIED_0016_SQL = readFileSync(
  fileURLToPath(new URL('../supabase/migrations/0016_body_type_backfill.sql', import.meta.url)),
  'utf8',
);

/** The `(body, hints)` rows of 0016, in the order the migration applies them. */
function hintsInSql(sql: string): Array<[string, string[]]> {
  const table = sql.match(/from\s*\(\s*values([\s\S]*?)\)\s*as\s*t\s*\(\s*body\s*,\s*hints\s*\)/i)?.[1];
  if (!table) throw new Error('the (body, hints) VALUES table was not found');
  // The equality assertion below compares whole rows, so a row written in a
  // shape this pattern misses fails the test instead of being silently dropped.
  return [...table.matchAll(/\(\s*'([a-z-]+)'\s*,\s*array\s*\[([\s\S]*?)\]\s*\)/gi)].map(
    ([, body, list]) => [body!, [...list!.matchAll(/'([^']*)'/g)].map(([, keyword]) => keyword!)],
  );
}

const HINTS_IN_SQL = hintsInSql(BACKFILL_SQL);

describe('the body-class backfill matches BODY_TYPE_HINTS', () => {
  it('uses the same classes and keywords, in the same order', () => {
    expect(HINTS_IN_SQL).toEqual(BODY_TYPE_HINTS);
  });

  it('leaves 0016 as applied history, with the retired keywords intact', () => {
    // Editing 0016 would never reach a live database; the migration stamp says
    // it ran. The repair lives in 0022, so 0016 must still read as it shipped.
    const applied = hintsInSql(APPLIED_0016_SQL);
    expect(applied.find(([body]) => body === 'hatchback')![1]).toContain('500');
    expect(applied.find(([body]) => body === 'pickup')![1]).toContain('ram');
    expect(HINTS_IN_SQL).not.toEqual(applied);
  });

  it('does not read «500» or «ram» as substrings of other models', () => {
    // The bug behind 0022: a Mercedes is not a hatchback, and a model that
    // merely contains r-a-m is not a pickup.
    expect(inferBodyType('Mercedes S 500')).toBeNull();
    expect(inferBodyType('Mercedes-Benz S 500')).toBeNull();
    expect(inferBodyType('GLE 500')).toBe('suv');
    expect(inferBodyType('Tramontana')).toBeNull();

    // The cars the keywords were there for still resolve.
    expect(inferBodyType('Fiat 500')).toBe('hatchback');
    expect(inferBodyType('Ram 1500')).toBe('pickup');
    expect(inferBodyType('Ram 3500 Laramie')).toBe('pickup');
  });

  it('resolves every keyword to the class it is listed under', () => {
    // The table is ordered and first match wins, so a keyword added above the
    // class it belongs to is shadowed: the UI would show that class even though
    // the keyword sits under another one.
    for (const [body, keywords] of HINTS_IN_SQL) {
      for (const keyword of keywords) {
        expect(inferBodyType(keyword), `keyword «${keyword}»`).toBe(body);
      }
    }
  });

  it('still resolves every keyword in the applied 0016 table, bar the retired two', () => {
    // 0022 must not have changed the meaning of any surviving keyword: a row
    // 0016 classified correctly has to keep its class after the repair.
    for (const [body, keywords] of hintsInSql(APPLIED_0016_SQL)) {
      for (const keyword of keywords) {
        if (keyword === '500' || keyword === 'ram') continue;
        expect(inferBodyType(keyword), `keyword «${keyword}»`).toBe(body);
      }
    }
  });
});
