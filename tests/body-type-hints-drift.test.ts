import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BODY_TYPE_HINTS, inferBodyType } from '@alisales/schemas';

/**
 * 0016 backfills `vehicles.body_type` from the model, because the SQL search
 * filters on that column while the browser infers the class on the fly. Both
 * sides must use the same keywords in the same order (first match wins), or a
 * car can render as an SUV in the UI and be invisible to `/cars?bodyType=suv`
 * in the hosted catalogue. This is the one guard for that pairing.
 *
 * 0016 is applied history, though — `supabase db push` will never run it again.
 * If `BODY_TYPE_HINTS` gains a keyword later, do not copy it into 0016: new
 * writes store the inferred class already (`lib/data/publish-store.ts`), and a
 * repair for already-stored rows belongs in a new migration, at which point
 * this comparison moves to that migration.
 */
const BACKFILL_SQL = readFileSync(
  fileURLToPath(new URL('../supabase/migrations/0016_body_type_backfill.sql', import.meta.url)),
  'utf8',
);

/** The `(body, hints)` rows of 0016, in the order the migration applies them. */
function hintsInSql(sql: string): Array<[string, string[]]> {
  const table = sql.match(/from\s*\(\s*values([\s\S]*?)\)\s*as\s*t\s*\(\s*body\s*,\s*hints\s*\)/i)?.[1];
  if (!table) throw new Error('0016: the (body, hints) VALUES table was not found');
  // The equality assertion below compares whole rows, so a row written in a
  // shape this pattern misses fails the test instead of being silently dropped.
  return [...table.matchAll(/\(\s*'([a-z-]+)'\s*,\s*array\s*\[([\s\S]*?)\]\s*\)/gi)].map(
    ([, body, list]) => [body!, [...list!.matchAll(/'([^']*)'/g)].map(([, keyword]) => keyword!)],
  );
}

const HINTS_IN_SQL = hintsInSql(BACKFILL_SQL);

describe('0016 body-class backfill matches BODY_TYPE_HINTS', () => {
  it('uses the same classes and keywords, in the same order', () => {
    expect(HINTS_IN_SQL).toEqual(BODY_TYPE_HINTS);
  });

  it('reads a Lexus LX as an SUV without matching a bare «LX»', () => {
    // «سمند LX» is the model that exposed the bare keyword: Iran Khodro's
    // sedan carries a Lexus-looking suffix and used to land under شاسی‌بلند
    // in the grid, in the stored column and in the curated chips.
    expect(inferBodyType('سمند LX')).toBeNull();
    expect(inferBodyType('Samand LX')).toBeNull();
    expect(inferBodyType('Lexus LX 570')).toBe('suv');
    expect(inferBodyType('LX 570')).toBe('suv');
    expect(inferBodyType('LX570')).toBe('suv');
  });

  it('keeps the browse chips on the same rule', async () => {
    const { CAR_BODY_TYPES } = await import('../apps/web/lib/browse');
    const suv = CAR_BODY_TYPES.find((type) => type.key === 'suv');
    expect(suv?.keywords).not.toContain('lx');
    expect(suv?.keywords).toEqual(
      expect.arrayContaining(['lexus lx', 'lx 570', 'lx570']),
    );
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
});
