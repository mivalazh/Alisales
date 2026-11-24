/**
 * Measure the paged catalogue read (0020) on a synthetic catalogue.
 *
 * The pagination plan assumes certain indexes are the ones the planner picks
 * for the hot filter shapes. This script checks that instead of trusting it:
 *
 *   1. build an isolated PGlite database from the real migrations,
 *   2. load ~50 000 synthetic listings (80 % active, 10 % sold, 10 % private)
 *      spread over the cities, categories, body classes, years, prices and
 *      mileages the filters are built from,
 *   3. ANALYZE, then run `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` for each
 *      hot shape and report every scan node, the index it used (if any), the
 *      rows each node removed, the buffers read and the execution time.
 *
 * The SQL that is explained is not a copy of 0020: it is the `return query`
 * body of `supabase/migrations/0020_search_listings_page.sql` with its
 * declared filter variables replaced by literals. A change to the migration is
 * therefore measured as written, and the script fails loudly if the body gains
 * a variable it does not know how to bind.
 *
 * Literals matter for what the answer means: a constant lets Postgres fold
 * `where v_city is null or c.city = v_city` down to one predicate and consider
 * the city index, so "this index was used" here is the upper bound. The RPC
 * call timed alongside each plan is the real plpgsql path (where the variables
 * are parameters), so a difference between the two timings is information, not
 * noise: an index that is only reachable with a literal needs the caller to
 * inline the filter or the planner to choose a custom plan.
 *
 *   npx tsx scripts/measure-search-pagination.ts
 *   npx tsx scripts/measure-search-pagination.ts --listings=10000 --json
 *   npx tsx scripts/measure-search-pagination.ts --strict   # exit 1 if a 0020 index is unused
 *
 * PGlite is one connection with a cost model close to, but not identical to,
 * hosted Postgres: treat the chosen plans as strong evidence and the absolute
 * timings as indicative, not as production benchmarks. A 50 000-row PGlite
 * seq scan is far slower than the same scan on the hosted instance, so compare
 * shapes against each other rather than reading the milliseconds as latency.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createDb } from '../tests/helpers/pg';

const arg = (name: string): string | undefined => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
};
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

const COUNT = Math.max(1, Number(arg('listings') ?? process.env.MEASURE_LISTINGS ?? 50_000));
const PAGE_SIZE = Number(arg('limit') ?? 48);
const AS_JSON = flag('json');
const STRICT = flag('strict');

/** The indexes 0020 creates; the point of the run is to see these in plans. */
const PAGE_INDEXES = [
  'listings_page_order_idx',
  'listings_city_state_idx',
  'listings_price_idx',
  'vehicles_category_body_idx',
  'vehicles_year_idx',
  'vehicles_mileage_idx',
];

type Filters = Record<string, string | number | boolean>;

/**
 * The filter shapes buyers actually produce: unfiltered browse, each drawer
 * filter on its own, the two common pairs, free text, the Kish lens and a
 * second page over an indexed filter.
 */
const SHAPES: Array<{ name: string; filters: Filters; cursor?: boolean }> = [
  { name: '{} (browse)', filters: {} },
  { name: 'city=tehran', filters: { city: 'tehran' } },
  { name: 'category=car', filters: { category: 'car' } },
  { name: 'category=car bodyType=suv', filters: { category: 'car', bodyType: 'suv' } },
  { name: 'price 5–20bn', filters: { priceFrom: 5_000_000_000, priceTo: 20_000_000_000 } },
  { name: 'year 1395–1402', filters: { yearFrom: 1395, yearTo: 1402 } },
  { name: 'mileageMax=150000', filters: { mileageMax: 150_000 } },
  { name: 'q=سینتتیک (text)', filters: { q: 'سینتتیک' } },
  { name: 'kishOnly', filters: { kishOnly: true } },
  { name: '{} page 2', filters: {}, cursor: true },
  { name: 'city=tehran page 2', filters: { city: 'tehran' }, cursor: true },
];

// ── Seeding ──────────────────────────────────────────────────────────────────

/**
 * Load `count` vehicles + listings (one each) and their sellers.
 *
 * Row triggers are switched off for the insert: `check_price_anomaly` runs a
 * percentile over every active listing of the same brand/model/year for each
 * inserted row and `enforce_listing_guard` counts the seller's slots per row,
 * which is quadratic on a 50 000-row fixture and would measure trigger cost
 * rather than the read under test. Nothing in this script writes listings, so
 * disabling them for the fixture cannot hide a read-path effect.
 */
async function seed(db: PGlite, count: number): Promise<{ ms: number; public: number }> {
  const started = Date.now();
  const uuid = (prefix: string, series = 'g') =>
    `('00000000-0000-4000-${prefix}-' || lpad((${series})::text, 12, '0'))::uuid`;

  await db.exec(`
    alter table public.listings disable trigger user;

    insert into auth.users (id, phone)
    select ${uuid('b000')}, '+98910' || lpad(g::text, 8, '0')
    from generate_series(1, 64) g;

    insert into public.users (id, phone, display_name)
    select ${uuid('b000')}, '+98910' || lpad(g::text, 8, '0'), 'Load Seller ' || g
    from generate_series(1, 64) g;
  `);

  // ~85 % cars, ~10 % motorcycles, ~5 % machines; the category-specific
  // columns stay null where 0014's constraint forbids them.
  await db.exec(`
    insert into public.vehicles
      (id, created_by, brand, model, trim, year, mileage_km, gearbox, fuel, color,
       condition, plate_type, category, body_type, engine_cc, bike_type, heavy_type,
       working_hours)
    select
      ${uuid('a001')},
      ${uuid('b000', '1 + g % 64')},
      (array['peugeot','toyota','hyundai','kia','bmw','benz','saipa','ikco'])[1 + g % 8],
      (array['206','corolla','tucson','sportage','x5','s-class','saina','samand',
              'hilux','land cruiser','pride','shaheen'])[1 + g % 12],
      case when g % 4 = 0 then 'trim-' || (g % 5) end,
      1380 + (g % 23),
      (g * 37) % 300000,
      (case when g % 3 = 0 then 'automatic' else 'manual' end)::gearbox_type,
      (array['petrol','petrol','petrol','diesel','cng','hybrid'])[1 + g % 6]::fuel_type,
      (array['white','black','silver','gray','red','blue'])[1 + g % 6]::color_slug,
      (case when g % 9 = 0 then 'new' else 'used' end)::vehicle_condition,
      (case when g % 23 = 0 then 'kish' else 'standard' end)::plate_type,
      k.category,
      case when k.category = 'car'
           then (array['sedan','suv','hatchback','pickup','van'])[1 + g % 5] end,
      case when k.category = 'motorcycle' then 125 * (1 + g % 8) end,
      case when k.category = 'motorcycle'
           then (array['scooter','sport','cross','classic','touring'])[1 + g % 5] end,
      case when k.category = 'heavy'
           then (array['truck','tractor','loader','excavator'])[1 + g % 4] end,
      case when k.category = 'heavy' then (g % 5000) * 40 end
    from generate_series(1, ${count}) g
    cross join lateral (
      select case
        when g % 20 < 17 then 'car'
        when g % 20 < 19 then 'motorcycle'
        else 'heavy'
      end as category
    ) k;
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
      'لیستینگ سینتتیک شماره ' || g || ' برای اندازه‌گیری پلن ایندکس‌ها',
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

  // Plans without statistics are guesses; the whole exercise is about what the
  // planner does with real distributions.
  await db.exec(
    'analyze public.listings; analyze public.vehicles; analyze public.listing_photos;' +
      'analyze public.part_details; analyze public.showrooms; analyze public.subscriptions;',
  );

  const { rows } = await db.query<{ n: number }>(
    'select count(*)::int as n from public.listing_cards c where public.is_listing_public(c.id)',
  );
  return { ms: Date.now() - started, public: rows[0]!.n };
}

// ── Rendering 0020's own query with literals ─────────────────────────────────

const MIGRATION = readFileSync(
  fileURLToPath(new URL('../supabase/migrations/0020_search_listings_page.sql', import.meta.url)),
  'utf8',
);
const BODY_START = MIGRATION.indexOf('return query') + 'return query'.length;
const BODY_END = MIGRATION.lastIndexOf('\nend\n$fn$;');
if (BODY_START < 'return query'.length || BODY_END < BODY_START) {
  throw new Error('0020_search_listings_page.sql: could not find the search_listings_page body');
}
const PAGE_BODY = MIGRATION.slice(BODY_START, BODY_END);

const literal = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
};

const TEXT_VARS: Record<string, string> = {
  brand: 'v_brand',
  model: 'v_model',
  trim: 'v_trim',
  gearbox: 'v_gearbox',
  fuel: 'v_fuel',
  plateType: 'v_plate',
  condition: 'v_condition',
  city: 'v_city',
  bodyType: 'v_body',
  category: 'v_category',
  bikeType: 'v_bike',
  heavyType: 'v_heavy',
  insurance: 'v_insurance',
  paintCondition: 'v_paint',
  chassisCondition: 'v_chassis',
  technicalInspection: 'v_inspection',
  q: 'v_q',
};
const INT_VARS: Record<string, string> = {
  yearFrom: 'v_year_from',
  yearTo: 'v_year_to',
  priceFrom: 'v_price_from',
  priceTo: 'v_price_to',
  mileageMin: 'v_mileage_min',
  mileageMax: 'v_mileage_max',
  engineCcMin: 'v_engine_min',
  engineCcMax: 'v_engine_max',
  workingHoursMax: 'v_hours_max',
};

export interface RenderedPage {
  sql: string;
  limit: number;
  cursor: string | null;
}

/** Cursor payload 0020 emits, decoded for the continuation shape. */
function cursorKeys(cursor: string | null): Record<string, string> {
  const keys: Record<string, string> = {
    c_k1: 'null',
    c_k2: 'null',
    c_k3: 'null',
    c_k4: 'null',
    c_k5: 'null',
    c_k6: 'null',
  };
  if (!cursor) return keys;
  const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as Record<
    string,
    string | number
  >;
  keys.c_k1 = literal(parsed.k1);
  keys.c_k2 = literal(parsed.k2);
  keys.c_k3 = literal(parsed.k3);
  keys.c_k4 = String(parsed.k4);
  keys.c_k5 = String(parsed.k5);
  keys.c_k6 = literal(parsed.k6);
  return keys;
}

/** 0020's page query with the declared variables bound to literals. */
export function renderPage(
  filters: Filters,
  limit: number,
  cursor: string | null,
): RenderedPage {
  const clamped = Math.max(1, Math.min(limit, 100));
  const bindings: Record<string, string> = {
    v_hash: `md5((${literal(JSON.stringify(filters))}::jsonb)::text)`,
    v_limit: String(clamped),
    p_cursor: cursor ? literal(cursor) : 'null',
    v_has_report: (filters.hasReport === true || filters.hasReport === 'true' ? 'true' : 'null'),
    v_kish: (filters.kishOnly === true || filters.kishOnly === 'true' ? 'true' : 'false'),
    ...cursorKeys(cursor),
  };
  for (const [filter, variable] of Object.entries(TEXT_VARS)) {
    bindings[variable] = literal(filters[filter]);
  }
  for (const [filter, variable] of Object.entries(INT_VARS)) {
    bindings[variable] = literal(filters[filter] === '' ? null : filters[filter]);
  }

  const sql = PAGE_BODY.replace(/\b(v_[a-z0-9_]+|c_k[1-6]|p_cursor)\b/g, (name) => {
    const bound = bindings[name];
    if (bound === undefined) {
      throw new Error(`0020 added a variable this measurement does not bind: ${name}`);
    }
    return bound;
  });
  return { sql, limit: clamped, cursor };
}

// ── Plan collection ─────────────────────────────────────────────────────────

interface PlanNode {
  'Node Type': string;
  'Index Name'?: string;
  'Relation Name'?: string;
  'Actual Rows'?: number;
  'Rows Removed by Filter'?: number;
  'Shared Hit Blocks'?: number;
  'Shared Read Blocks'?: number;
  'Sort Method'?: string;
  'Sort Space Used'?: number;
  Plans?: PlanNode[];
}

const walk = (node: PlanNode, depth: number, out: Array<{ depth: number; node: PlanNode }>) => {
  out.push({ depth, node });
  for (const child of node.Plans ?? []) walk(child, depth + 1, out);
};

interface ShapeResult {
  name: string;
  filters: Filters;
  limit: number;
  cursor: boolean | null;
  nextCursor: string | null;
  rows: number;
  planMs: number;
  execMs: number;
  hit: number;
  read: number;
  nodes: Array<{ depth: number; node: PlanNode }>;
  indexes: string[];
  rpcMs: number;
  rpcBytes: number;
}

async function explainShape(
  db: PGlite,
  shape: (typeof SHAPES)[number],
): Promise<{ first: ShapeResult; cursor: string | null }> {
  // Page 1 of a continuation shape has to exist before the cursor does.
  const cursor = shape.cursor ? await seedCursor(db, shape.filters) : null;
  const rendered = renderPage(shape.filters, PAGE_SIZE, cursor);

  const { rows } = await db.query<{ 'QUERY PLAN': unknown }>(
    `explain (analyze, buffers, format json) ${rendered.sql}`,
  );
  const raw = rows[0]!['QUERY PLAN'];
  const plan = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Array<{
    Plan: PlanNode;
    'Planning Time': number;
    'Execution Time': number;
  }>;
  const root = plan[0]!;
  const nodes: Array<{ depth: number; node: PlanNode }> = [];
  walk(root.Plan, 0, nodes);

  const indexes = [
    ...new Set(
      nodes
        .map(({ node }) => node['Index Name'])
        .filter((name): name is string => typeof name === 'string'),
    ),
  ];
  const hit = nodes.reduce((sum, { node }) => sum + (node['Shared Hit Blocks'] ?? 0), 0);
  const read = nodes.reduce((sum, { node }) => sum + (node['Shared Read Blocks'] ?? 0), 0);

  // The production path: the function call itself. Its plan is opaque (a
  // Function Scan) but its time and buffers are real, and that is what a route
  // request pays for.
  const rpcStart = performance.now();
  const rpc = await db.query<{ rows: unknown; next_cursor: string | null }>(
    'select rows, next_cursor from public.search_listings_page($1::jsonb, $2, $3)',
    [JSON.stringify(shape.filters), PAGE_SIZE, cursor],
  );
  const rpcMs = performance.now() - rpcStart;
  const payload = rpc.rows[0]!.rows;
  const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const returned = Array.isArray(parsed) ? parsed.length : 0;

  return {
    first: {
      name: shape.name,
      filters: shape.filters,
      limit: rendered.limit,
      cursor: shape.cursor ? true : null,
      nextCursor: rpc.rows[0]!.next_cursor,
      rows: returned,
      planMs: root['Planning Time'],
      execMs: root['Execution Time'],
      hit,
      read,
      nodes,
      indexes,
      rpcMs,
      rpcBytes: Buffer.byteLength(JSON.stringify(parsed ?? [])),
    },
    cursor: rpc.rows[0]!.next_cursor,
  };
}

/** Page-1 cursor for a filter set, taken from the function itself. */
async function seedCursor(db: PGlite, filters: Filters): Promise<string | null> {
  const { rows } = await db.query<{ next_cursor: string | null }>(
    'select next_cursor from public.search_listings_page($1::jsonb, $2, null)',
    [JSON.stringify(filters), PAGE_SIZE],
  );
  return rows[0]!.next_cursor;
}

// ── Reporting ───────────────────────────────────────────────────────────────

const describeNode = (node: PlanNode): string => {
  const parts = [node['Node Type']];
  if (node['Index Name']) parts.push(`using ${node['Index Name']}`);
  else if (node['Relation Name']) parts.push(`on ${node['Relation Name']}`);
  if (node['Sort Method']) parts.push(`(${node['Sort Method']}, ${node['Sort Space Used']} kB)`);
  if (node['Actual Rows'] !== undefined) parts.push(`rows=${node['Actual Rows']}`);
  if (node['Rows Removed by Filter']) parts.push(`removed=${node['Rows Removed by Filter']}`);
  const io = (node['Shared Hit Blocks'] ?? 0) + (node['Shared Read Blocks'] ?? 0);
  if (io) parts.push(`buffers=${io}`);
  return parts.join(' ');
};

function report(results: ShapeResult[]): void {
  const out: string[] = [];
  out.push('');
  out.push('index usage by shape');
  out.push(
    '──────────────────────────────────────────────────────────────────────────────────────',
  );
  for (const result of results) {
    out.push('');
    out.push(
      `${result.name}  ·  ${result.rows} rows  ·  ${result.execMs.toFixed(1)} ms plan + ` +
        `${result.rpcMs.toFixed(1)} ms rpc  ·  ${result.hit + result.read} buffers`,
    );
    for (const { depth, node } of result.nodes) {
      out.push(`  ${'  '.repeat(depth)}${describeNode(node)}`);
    }
    out.push(
      `  → indexes: ${result.indexes.length ? result.indexes.join(', ') : 'none'}`,
    );
    if (result.cursor !== null) {
      out.push(`  → next_cursor: ${result.nextCursor ? 'present' : 'null'}`);
    }
  }

  out.push('');
  out.push('0020 index coverage');
  out.push(
    '──────────────────────────────────────────────────────────────────────────────────────',
  );
  const unused: string[] = [];
  for (const index of PAGE_INDEXES) {
    const users = results.filter((result) => result.indexes.includes(index));
    if (!users.length) unused.push(index);
    out.push(
      `${index.padEnd(30)} ${users.length ? users.map((user) => user.name).join(', ') : 'NOT USED by any measured shape'}`,
    );
  }
  const extras = [...new Set(results.flatMap((result) => result.indexes))].filter(
    (index) => !PAGE_INDEXES.includes(index),
  );
  if (extras.length) out.push(`other indexes seen: ${extras.join(', ')}`);
  if (unused.length) {
    out.push('');
    out.push(
      `note: ${unused.length} of ${PAGE_INDEXES.length} 0020 indexes were not chosen for these shapes.`,
    );
  }
  out.push('');
  console.log(out.join('\n'));
}

// ── Run ─────────────────────────────────────────────────────────────────────

const db = await createDb();
try {
  const seeded = await seed(db, COUNT);
  if (!AS_JSON) {
    console.log(
      `seeded ${COUNT.toLocaleString('en-US')} listings (${seeded.public.toLocaleString('en-US')} public) ` +
        `in ${(seeded.ms / 1000).toFixed(1)}s, analyzed`,
    );
  }

  const results: ShapeResult[] = [];
  for (const shape of SHAPES) {
    results.push((await explainShape(db, shape)).first);
  }

  if (AS_JSON) {
    console.log(
      JSON.stringify(
        {
          listings: COUNT,
          pageSize: PAGE_SIZE,
          publicRows: seeded.public,
          seedMs: seeded.ms,
          shapes: results,
          pageIndexes: PAGE_INDEXES,
          unusedPageIndexes: PAGE_INDEXES.filter(
            (index) => !results.some((result) => result.indexes.includes(index)),
          ),
        },
        null,
        2,
      ),
    );
  } else {
    report(results);
  }

  const unused = PAGE_INDEXES.filter(
    (index) => !results.some((result) => result.indexes.includes(index)),
  );
  if (STRICT && unused.length) {
    console.error(`--strict: unused 0020 indexes: ${unused.join(', ')}`);
    process.exitCode = 1;
  }
} finally {
  await db.close();
}
