/**
 * Fill `vehicles.browse_groups` for rows written before 0024.
 *
 *   npx tsx scripts/backfill-browse-groups.ts --dry-run
 *   npx tsx scripts/backfill-browse-groups.ts --batch=500 --concurrency=8
 *
 * The mapping is `browseGroupsFor()` from `@alisales/schemas` — the same table
 * and matcher the chips use — so the backfill cannot invent a group the chip
 * would not show. That is why this is a script and not a migration: 0022 had
 * to mirror the keyword list in SQL and the drift test exists because of it.
 *
 * Idempotent: only rows whose array differs are written, so a second run reads
 * the whole table and updates nothing. Non-cars are stored as `{}` (the chips
 * are car classes), which is also what a fresh insert that omits the column
 * gets from the default.
 *
 * Credentials come from the environment, never from an argument:
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SECRET_KEY.
 */

import { createClient } from '@supabase/supabase-js';
import { browseGroupsFor } from '@alisales/schemas';

const arg = (name: string, fallback: number): number => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  const parsed = Number(hit?.slice(name.length + 3));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const DRY_RUN = process.argv.includes('--dry-run');

const BATCH = arg('batch', 500);
const CONCURRENCY = arg('concurrency', 8);
const LIMIT = arg('limit', Number.MAX_SAFE_INTEGER);

interface VehicleRow {
  id: string;
  model: string | null;
  trim: string | null;
  category: string | null;
}

/** Order-insensitive equality: `{suv,sedan}` and `{sedan,suv}` are one value. */
function sameGroups(current: string[] | null, next: string[]): boolean {
  const left = [...(current ?? [])].sort().join(',');
  const right = [...next].sort().join(',');
  return left === right;
}

function groupsFor(row: VehicleRow): string[] {
  // The chips are car classes; a motorcycle or a machine has a model line the
  // keyword table can still match by accident («Sportster», «Camaro»), and no
  // chip must ever show it.
  if ((row.category ?? 'car') !== 'car') return [];
  return browseGroupsFor(row.model, row.trim);
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error(
      'SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SECRET_KEY must be set.\n' +
        'Nothing was written.',
    );
    process.exit(2);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  let scanned = 0;
  let changed = 0;
  let failed = 0;
  const changedSamples: Array<{ id: string; groups: string[] }> = [];

  for (let from = 0; from < LIMIT; from += BATCH) {
    const { data, error } = await sb
      .from('vehicles')
      .select('id, model, trim, category, browse_groups')
      .order('id')
      .range(from, from + Math.min(BATCH, LIMIT - from) - 1);
    if (error) throw new Error(`read vehicles failed: ${error.message}`);

    const rows = (data ?? []) as Array<VehicleRow & { browse_groups: string[] | null }>;
    if (rows.length === 0) break;
    scanned += rows.length;

    const pending = rows
      .map((row) => ({ row, next: groupsFor(row) }))
      .filter(({ row, next }) => !sameGroups(row.browse_groups, next));

    // Bounded fan-out: one PATCH per changed row (an upsert would have to
    // restate every not-null vehicle column, and a bulk update cannot carry a
    // different array per id).
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const slice = pending.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        slice.map(async ({ row, next }) => {
          if (DRY_RUN) return { ok: true, error: null as string | null };
          const { error: updateError } = await sb
            .from('vehicles')
            .update({ browse_groups: next })
            .eq('id', row.id);
          return { ok: !updateError, error: updateError?.message ?? null };
        }),
      );
      for (const [index, result] of results.entries()) {
        if (result.ok) {
          changed += 1;
          if (changedSamples.length < 10) {
            changedSamples.push({ id: slice[index]!.row.id, groups: slice[index]!.next });
          }
        } else {
          failed += 1;
          console.error(`update ${slice[index]!.row.id} failed: ${result.error}`);
        }
      }
    }

    const seen = Math.min(from + rows.length, LIMIT);
    console.log(
      `${DRY_RUN ? 'would fill' : 'filled'} ${changed} of ${scanned} scanned ` +
        `(${seen}${LIMIT === Number.MAX_SAFE_INTEGER ? '' : ` / ${LIMIT}`} rows read, ${failed} failed)`,
    );
    if (rows.length < BATCH) break;
  }

  for (const sample of changedSamples) {
    console.log(`  ${sample.id}: ${sample.groups.length ? sample.groups.join(' ') : '{}'}`);
  }
  console.log(
    `${DRY_RUN ? 'dry run: nothing written' : 'done'} — scanned ${scanned}, ` +
      `${DRY_RUN ? 'pending' : 'written'} ${changed}, failed ${failed}`,
  );
  if (failed > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
