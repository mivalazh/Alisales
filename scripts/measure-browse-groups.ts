/**
 * 50 000-row comparison of the two ways to answer a curated `?body=` chip.
 *
 *   A. keyword `ilike` (what 0023 ships): the chip's words matched against
 *      `model`/`trim` — no index can serve a leading `%`, so the visible set is
 *      scanned and sorted, and the first 48 rows are kept.
 *   B. persisted `browse_groups` (0024 prototype): one array containment test
 *      (`browse_groups && array['suv']`) a GIN index answers directly.
 *
 * Both arms run the same query shape — listings joined to vehicles, the
 * visibility function, cars only, the page's ORDER BY … LIMIT 48 — against the
 * same 50 000 rows, so the difference is the predicate, not the harness. The
 * keyword lists come from `CAR_BODY_GROUPS`, and the stored arrays are produced
 * by `browseGroupsFor`, so the arms compare implementations, not copies of the
 * table. A count-only query per group runs beside them: if the two arms ever
 * disagree on *which* rows match, the timings mean nothing and the script fails.
 *
 *   npx tsx scripts/measure-browse-groups.ts
 *   npx tsx scripts/measure-browse-groups.ts --listings=100000 --runs=5 --json
 *
 * PGlite is one connection with a cost model close to hosted Postgres but not
 * identical: the plans (index chosen, rows removed) transfer, the absolute
 * milliseconds do not. Read the two arms against each other, not as latency.
 */

import { CAR_BODY_GROUPS, browseGroupsFor, inferBodyType } from '@alisales/schemas';
import { createDb } from '../tests/helpers/pg';
import type { PGlite } from '@electric-sql/pglite';

const arg = (name: string, fallback: number): number => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  const parsed = Number(hit?.slice(name.length + 3));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const COUNT = arg('listings', 50_000);
const RUNS = arg('runs', 3);
const PAGE_SIZE = arg('limit', 48);
const AS_JSON = process.argv.includes('--json');

/** The chips every catalogue has a link to. */
const GROUPS = ['suv', 'sedan', 'hatchback', 'coupe', 'crossover', 'luxury', 'hybrid'] as const;

/** Words a chip matches, exactly as `filterByBodyType` builds them. */
function wordsFor(key: string): string[] {
  const group = CAR_BODY_GROUPS.find((entry) => entry.key === key);
  if (!group) throw new Error(`no CAR_BODY_GROUPS entry for ${key}`);
  return [...group.keywords, ...(group.browseOnly ?? [])];
}

/**
 * 20 buckets of the synthetic catalogue, each 5 % of the rows.
 *
 * The models are real ones the keyword table knows, so both arms see a
 * realistic spread: a group with 30 % of the catalogue (suv) and one with 5 %
 * (hybrid), plus a motorcycle whose model («Sportster S») contains a coupe
 * word — the case the car-only predicate exists for. `browseGroupsFor` fills
 * the stored array, so a bucket cannot carry a hand-written set that disagrees
 * with the table.
 */
const BUCKETS: Array<{ bucket: number; model: string; trim: string | null; category?: 'motorcycle' }> = [
  { bucket: 0, model: 'Land Cruiser', trim: 'VXR' },
  { bucket: 1, model: 'X5', trim: 'xDrive40i' },
  { bucket: 2, model: 'Patrol', trim: 'Platinum' },
  { bucket: 3, model: 'Tucson', trim: null },
  { bucket: 4, model: 'Camry', trim: null },
  { bucket: 5, model: 'Corolla', trim: null },
  { bucket: 6, model: 'Cerato', trim: null },
  { bucket: 7, model: 'Golf', trim: 'GTI' },
  { bucket: 8, model: 'Fiat 500', trim: null },
  { bucket: 9, model: 'Pride', trim: null },
  { bucket: 10, model: '911', trim: 'Carrera' },
  { bucket: 11, model: 'Mustang', trim: null },
  { bucket: 12, model: 'HR-V', trim: null },
  { bucket: 13, model: 'Prius', trim: null },
  { bucket: 14, model: 'S-Class', trim: 'S 500' },
  { bucket: 15, model: 'Panamera', trim: null },
  { bucket: 16, model: 'RX 450h', trim: 'F-Sport' },
  { bucket: 17, model: 'Sportage', trim: null },
  { bucket: 18, model: 'Camry', trim: 'Hybrid' },
  { bucket: 19, model: 'Sportster S', trim: null, category: 'motorcycle' },
];

async function seed(db: PGlite, count: number): Promise<number> {
  const started = Date.now();
  const uuid = (prefix: string, series = 'g') =>
    `('00000000-0000-4000-${prefix}-' || lpad((${series})::text, 12, '0'))::uuid`;

  // The buckets as a VALUES list, with each row's array derived in TypeScript.
  const values = BUCKETS.map(({ bucket, model, trim, category }, index) => {
    const groups = category ? [] : browseGroupsFor(model, trim);
    const inferred = category ? null : inferBodyType(model);
    const bodyType = inferred ? `'${inferred}'` : 'null';
    return (
      `(${index}, '${model.replace(/'/g, "''")}', ${trim === null ? 'null' : `'${trim.replace(/'/g, "''")}'`}, ` +
      `'${groups.length ? `{${groups.join(',')}}` : '{}'}'::text[], ` +
      `'${category ?? 'car'}', ${bodyType})`
    );
  });

  await db.exec(`
    alter table public.listings disable trigger user;

    insert into auth.users (id, phone)
    select ${uuid('b000')}, '+98910' || lpad(g::text, 8, '0')
    from generate_series(1, 64) g;

    insert into public.users (id, phone, display_name)
    select ${uuid('b000')}, '+98910' || lpad(g::text, 8, '0'), 'Load Seller ' || g
    from generate_series(1, 64) g;
  `);

  await db.exec(`
    insert into public.vehicles
      (id, created_by, brand, model, trim, year, mileage_km, gearbox, fuel, color,
       condition, plate_type, category, body_type, browse_groups,
       engine_cc, bike_type)
    select
      ${uuid('a001')},
      ${uuid('b000', '1 + g % 64')},
      (array['toyota','bmw','nissan','hyundai','kia','benz','saipa','ikco'])[1 + g % 8],
      b.model,
      b.trim,
      1380 + (g % 23),
      (g * 37) % 300000,
      (case when g % 3 = 0 then 'automatic' else 'manual' end)::gearbox_type,
      (array['petrol','petrol','petrol','diesel','cng','hybrid'])[1 + g % 6]::fuel_type,
      (array['white','black','silver','gray','red','blue'])[1 + g % 6]::color_slug,
      (case when g % 9 = 0 then 'new' else 'used' end)::vehicle_condition,
      (case when g % 23 = 0 then 'kish' else 'standard' end)::plate_type,
      b.category,
      b.body_type,
      b.browse_groups,
      case when b.category = 'motorcycle' then 125 * (1 + g % 8) end,
      case when b.category = 'motorcycle' then 'sport' end
    from generate_series(1, ${count}) g
    join (values
      ${values.join(',\n      ')}
    ) as b(bucket, model, trim, browse_groups, category, body_type)
      on b.bucket = g % ${BUCKETS.length};
  `);

  await db.exec(`
    insert into public.listings
      (id, slug, created_by, vehicle_id, price_irr, city, description, state,
       featured, published_at, expires_at, created_at)
    select
      ${uuid('a002')},
      'load-' || g,
      ${uuid('b000', '1 + g % 64')},
      ${uuid('a001')},
      500000000::bigint + (g % 400)::bigint * 250000000::bigint,
      case
        when g % 10 < 4 then 'tehran'
        when g % 10 = 4 then 'kish'
        when g % 10 = 5 then 'mashhad'
        when g % 10 = 6 then 'isfahan'
        when g % 10 = 7 then 'shiraz'
        when g % 10 = 8 then 'tabriz'
        else 'ahvaz'
      end,
      'لیستینگ سینتتیک شماره ' || g || ' برای اندازه‌گیری گروه‌های مرور',
      (case
        when g % 100 < 80 then 'active'
        when g % 100 < 90 then 'sold'
        when g % 100 < 95 then 'paused'
        else 'draft'
      end)::listing_state,
      g % 97 = 0,
      now() - ((g % 900) || ' days')::interval - ((g % 24) || ' hours')::interval,
      now() + interval '90 days',
      now() - ((g % 1200) || ' days')::interval
    from generate_series(1, ${count}) g;

    alter table public.listings enable trigger user;
  `);

  await db.exec(
    'analyze public.listings; analyze public.vehicles; analyze public.users; analyze public.showrooms;',
  );
  return Date.now() - started;
}

// ── The two predicates ───────────────────────────────────────────────────────

/** A: the 0023 predicate, as `search_listings_page` renders it. */
function keywordPredicate(key: string): string {
  const words = wordsFor(key)
    .map((word) => `'${word.replace(/'/g, "''")}'`)
    .map((word) => `v.model ilike '%' || ${word} || '%' or coalesce(v.trim, '') ilike '%' || ${word} || '%'`)
    .join('\n        or ');
  return `(\n        ${words}\n      )`;
}

/** B: the persisted array, one containment test. */
const arrayPredicate = (key: string): string => `v.browse_groups && array['${key}']::text[]`;

/**
 * The index question on its own: a chip's predicate over `vehicles`, with
 * nothing else in the query for the planner to weigh. If GIN cannot win here,
 * it will not win inside the page either.
 */
function probeQuery(predicate: string): string {
  return `
    select count(*)::int as n
    from public.vehicles v
    where coalesce(v.category, 'car') = 'car'
      and ${predicate}`;
}

function pageQuery(predicate: string): string {
  return `
    select l.id
    from public.listings l
    join public.vehicles v on v.id = l.vehicle_id
    where public.is_listing_public(l.id)
      and coalesce(v.category, 'car') = 'car'
      and ${predicate}
    order by l.published_at desc, l.created_at desc, l.id desc
    limit ${PAGE_SIZE}`;
}

function countQuery(predicate: string): string {
  return `
    select count(*)::int as n
    from public.listings l
    join public.vehicles v on v.id = l.vehicle_id
    where public.is_listing_public(l.id)
      and coalesce(v.category, 'car') = 'car'
      and ${predicate}`;
}

// ── Plan collection ─────────────────────────────────────────────────────────

interface PlanNode {
  'Node Type': string;
  'Index Name'?: string;
  'Relation Name'?: string;
  'Actual Rows'?: number;
  'Actual Total Time'?: number;
  'Rows Removed by Filter'?: number;
  'Shared Hit Blocks'?: number;
  'Shared Read Blocks'?: number;
  Plans?: PlanNode[];
}

const walk = (node: PlanNode, depth: number, out: Array<{ depth: number; node: PlanNode }>) => {
  out.push({ depth, node });
  for (const child of node.Plans ?? []) walk(child, depth + 1, out);
};

interface Arm {
  rows: number;
  matches: number;
  execMs: number[];
  indexes: string[];
  scanTypes: string[];
  removed: number;
  buffers: number;
}

async function explain(
  db: PGlite,
  sql: string,
): Promise<Omit<Arm, 'matches'>> {
  const execMs: number[] = [];
  let nodes: Array<{ depth: number; node: PlanNode }> = [];
  for (let run = 0; run < RUNS; run += 1) {
    const { rows } = await db.query<{ 'QUERY PLAN': unknown }>(
      `explain (analyze, buffers, format json) ${sql}`,
    );
    const raw = rows[0]!['QUERY PLAN'];
    const plan = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Array<{
      Plan: PlanNode;
      'Execution Time': number;
    }>;
    execMs.push(plan[0]!['Execution Time']);
    nodes = [];
    walk(plan[0]!.Plan, 0, nodes);
  }
  const scans = nodes.filter(({ node }) =>
    /Scan|Bitmap/.test(node['Node Type']),
  );
  return {
    rows: scans.reduce((sum, { node }) => sum + (node['Actual Rows'] ?? 0), 0),
    execMs,
    indexes: [
      ...new Set(
        nodes
          .map(({ node }) => node['Index Name'])
          .filter((name): name is string => typeof name === 'string'),
      ),
    ],
    scanTypes: scans.map(({ node }) => node['Node Type']),
    // Only the node that carries the chip predicate: summing every node mixes
    // the join's filters into a number meant to be about the chip.
    removed: Math.max(0, ...nodes.map(({ node }) => node['Rows Removed by Filter'] ?? 0)),
    buffers: nodes.reduce(
      (sum, { node }) => sum + (node['Shared Hit Blocks'] ?? 0) + (node['Shared Read Blocks'] ?? 0),
      0,
    ),
  };
}

async function matchesOf(db: PGlite, predicate: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(countQuery(predicate));
  return rows[0]!.n;
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};
const ms = (value: number): string => `${value.toFixed(1)} ms`;

async function main(): Promise<void> {
  const db = await createDb();
  try {
    const seedMs = await seed(db, COUNT);
    const { rows: totalRows } = await db.query<{ vehicles: number; listings: number }>(
      `select (select count(*)::int from public.vehicles) as vehicles,
              (select count(*)::int from public.listings) as listings`,
    );
    const total = totalRows[0]!;

    // Is the GIN index there, and what does the plan look like when the planner
    // is not allowed a seq scan? Without this, "the array arm is faster" could
    // be read as "the index works", and the two are different claims.
    const inventory = await db.query<{ indexname: string }>(
      `select indexname from pg_indexes where tablename = 'vehicles' order by 1`,
    );
    console.log(
      `\nindexes on public.vehicles: ${inventory.rows.map((row) => row.indexname).join(', ')}\n`,
    );
    await db.exec('set enable_seqscan = off; set enable_bitmapscan = on;');
    const forcedArray = await explain(db, probeQuery(arrayPredicate('suv')));
    const forcedKeyword = await explain(db, probeQuery(keywordPredicate('suv')));
    await db.exec('set enable_seqscan = on;');

    const results: Array<{
      group: string;
      keyword: Omit<Arm, 'matches'> & { matches: number };
      array: Omit<Arm, 'matches'> & { matches: number };
      probeKeyword: Omit<Arm, 'matches'>;
      probeArray: Omit<Arm, 'matches'>;
    }> = [];

    for (const group of GROUPS) {
      const keyword = await explain(db, pageQuery(keywordPredicate(group)));
      const array = await explain(db, pageQuery(arrayPredicate(group)));
      const probeKeyword = await explain(db, probeQuery(keywordPredicate(group)));
      const probeArray = await explain(db, probeQuery(arrayPredicate(group)));
      const keywordMatches = await matchesOf(db, keywordPredicate(group));
      const arrayMatches = await matchesOf(db, arrayPredicate(group));
      if (keywordMatches !== arrayMatches) {
        throw new Error(
          `${group}: the two arms disagree (${keywordMatches} keyword vs ${arrayMatches} array) — ` +
            'the stored arrays do not reproduce the chip predicate',
        );
      }
      results.push({
        group,
        keyword: { ...keyword, matches: keywordMatches },
        array: { ...array, matches: arrayMatches },
        probeKeyword,
        probeArray,
      });
    }

    if (AS_JSON) {
      console.log(
        JSON.stringify(
          {
            listings: total.listings,
            vehicles: total.vehicles,
            seedMs,
            pageSize: PAGE_SIZE,
            runs: RUNS,
            results,
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(
      `\n50k prototype — ${total.listings} listings / ${total.vehicles} vehicles ` +
        `(seeded in ${(seedMs / 1000).toFixed(1)} s), page ${PAGE_SIZE}, ${RUNS} runs per arm\n`,
    );
    console.log('### The index question: the chip predicate over `vehicles`\n');
    console.log(
      '| chip | rows | ILIKE | array && | ILIKE plan | array plan | ILIKE index | array index | ILIKE buffers | array buffers |',
    );
    console.log('|---|---|---|---|---|---|---|---|---|---|');
    for (const { group, probeKeyword, probeArray } of results) {
      console.log(
        `| ${group} | ${probeArray.rows} | ${ms(median(probeKeyword.execMs))} | ${ms(median(probeArray.execMs))} | ` +
          `${probeKeyword.scanTypes.join(' → ') || '—'} | ${probeArray.scanTypes.join(' → ') || '—'} | ` +
          `${probeKeyword.indexes.join(', ') || '—'} | ${probeArray.indexes.join(', ') || '—'} | ` +
          `${probeKeyword.buffers} | ${probeArray.buffers} |`,
      );
    }

    console.log(
      `\nforced (seq scan off) — suv: array ${ms(median(forcedArray.execMs))} ` +
        `${forcedArray.scanTypes.join(' → ') || '—'} [${forcedArray.indexes.join(', ') || 'no index'}], ` +
        `keyword ${ms(median(forcedKeyword.execMs))} ` +
        `${forcedKeyword.scanTypes.join(' → ') || '—'} [${forcedKeyword.indexes.join(', ') || 'no index'}]\n`,
    );

    console.log('\n### The catalogue page: visibility + join + ORDER BY … LIMIT\n');
    console.log(
      '| chip | matches | ILIKE median | array median | ILIKE indexes | array indexes | ILIKE buffers | array buffers |',
    );
    console.log('|---|---|---|---|---|---|---|---|');
    for (const { group, keyword, array } of results) {
      console.log(
        `| ${group} | ${keyword.matches} | ${ms(median(keyword.execMs))} | ${ms(median(array.execMs))} | ` +
          `${keyword.indexes.join(', ') || '—'} | ${array.indexes.join(', ') || '—'} | ` +
          `${keyword.buffers} | ${array.buffers} |`,
      );
    }
    console.log('\nplans (page shape):');
    for (const { group, keyword, array } of results) {
      console.log(
        `  ${group}: keyword ${keyword.scanTypes.join(' → ')} | array ${array.scanTypes.join(' → ')}`,
      );
    }
    console.log(
      '\nBoth arms returned the same rows for every chip (counts compared above). ' +
        'PGlite timings are indicative; compare the shapes and the buffers.',
    );
  } finally {
    await db.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
