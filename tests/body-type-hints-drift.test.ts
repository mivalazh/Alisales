import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BODY_TYPE_HINTS, inferBodyType } from '@alisales/schemas';

/**
 * 0016 backfills `vehicles.body_type` from the model, because the SQL search
 * filters on that column while the browser infers the class on the fly. Both
 * sides must use the same keywords in the same order (first match wins), or a
 * car can render as an SUV in the UI and be invisible to `/cars?bodyType=suv`
 * in the hosted catalogue.
 *
 * This test reads the actual migration file and compares it with the exported
 * table, so editing one side without the other fails here instead of shipping
 * two disagreeing inferences.
 *
 * 0016 is applied history, though — `supabase db push` will never run it again.
 * So if `BODY_TYPE_HINTS` gains a keyword later, do not copy it into 0016: new
 * writes store the inferred class already (`lib/data/publish-store.ts`), and a
 * repair for already-stored rows belongs in a new migration, at which point
 * this comparison moves to that migration.
 */
const BACKFILL_SQL = readFileSync(
  fileURLToPath(new URL('../supabase/migrations/0016_body_type_backfill.sql', import.meta.url)),
  'utf8',
);

/** The (body, hints) rows of 0016, in the order the migration applies them. */
function sqlHintRows(sql: string): Array<[string, string[]]> {
  const values = sql.match(/from\s*\(\s*values([\s\S]*?)\)\s*as\s*t\s*\(\s*body\s*,\s*hints\s*\)/i)?.[1];
  if (!values) throw new Error('0016: the (body, hints) VALUES table was not found');

  const rows = [
    ...values.matchAll(/\(\s*'([a-z-]+)'\s*,\s*array\s*\[([\s\S]*?)\]\s*\)/gi),
  ];
  if (rows.length === 0) throw new Error('0016: the (body, hints) VALUES table has no rows');

  return rows.map(([, body, list]) => [
    body!,
    [...list!.matchAll(/'([^']*)'/g)].map((match) => match[1]!),
  ]);
}

describe('0016 body-class backfill matches BODY_TYPE_HINTS', () => {
  it('uses the same classes, keywords and order as the client inference', () => {
    const expected = BODY_TYPE_HINTS.map(([body, keywords]) => [body, [...keywords]]);
    expect(sqlHintRows(BACKFILL_SQL)).toEqual(expected);
  });

  it('resolves every SQL keyword to the class 0016 would write', () => {
    // Order matters: the first class with a matching keyword wins. A keyword
    // moved between classes — or added to the wrong one — changes what the UI
    // shows even if the sets still look plausible.
    for (const [body, keywords] of sqlHintRows(BACKFILL_SQL)) {
      for (const keyword of keywords) {
        expect(inferBodyType(keyword), `keyword «${keyword}»`).toBe(body);
      }
    }
  });
});
