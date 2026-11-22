/**
 * Build-time guard for the statically generated catalogue.
 *
 * A production build hides the demo seed, so the catalogue can only come from
 * hosted Supabase rows. The read client is null unless
 * `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are present
 * while the pages are prerendered; without them every catalogue page renders
 * zero listings and that empty HTML is what the CDN caches. Nothing fails, the
 * site just looks broken.
 *
 * This guard turns that silent state into a failed build. Credential-less
 * builds (local previews) can opt out explicitly with
 * `ALLOW_EMPTY_CATALOGUE=true`; the runbooks document both.
 */

/** Values that explicitly ask for the demo seed to stay visible. */
export const DEMO_VISIBLE_FLAGS = new Set(['false', '0', 'no', 'off']);

/**
 * The one demo-seed rule, shared by the runtime helper and the build guard.
 * An explicit value wins; unset follows the build mode.
 */
export function demoListingsHiddenValue(
  raw: string | undefined,
  nodeEnv: string | undefined,
): boolean {
  const value = raw?.trim().toLowerCase();
  if (value) return !DEMO_VISIBLE_FLAGS.has(value);
  return nodeEnv === 'production';
}

export interface CataloguePrerenderInput {
  /** `process.env.NEXT_PHASE`; only `next build` sets `phase-production-build`. */
  phase: string | undefined;
  /** `ALLOW_EMPTY_CATALOGUE` — the same opt-out as the config guard. */
  allowEmpty: string | undefined;
  /** What was read, for the message. */
  source: string;
  /** Rows the read produced for the page's first paint. */
  rows: number;
  /** Why the read produced nothing, when it failed instead of answering []. */
  failure?: string;
}

/**
 * Message for a catalogue read that would prerender an empty page, or null.
 *
 * The config guard in `next.config.ts` only sees the environment: it catches a
 * build with no credentials at all. It cannot catch credentials that are
 * present but wrong, expired, pointed at an unreachable project, or missing the
 * migrations. In those cases the read throws, the data layer falls back to the
 * seed (hidden in production), and every catalogue page prerenders empty HTML
 * that the CDN then caches. This checks what the read actually returned.
 *
 * Only `next build` sets `NEXT_PHASE=phase-production-build` (before it creates
 * the static workers); `next dev` and `next start` never do, so a served page
 * can never trip this.
 */
export function cataloguePrerenderIssue(input: CataloguePrerenderInput): string | null {
  if (input.phase !== 'phase-production-build') return null;
  if (enabled(input.allowEmpty) || input.rows > 0) return null;
  const cause = input.failure
    ? `the read failed (${input.failure})`
    : 'the hosted catalogue returned no rows';
  return `Refusing to prerender an empty ${input.source}: ${cause}. Credentials are not enough — the project must be reachable and the migrations applied. Set ALLOW_EMPTY_CATALOGUE=true only for an intentional empty catalogue.`;
}

export interface CatalogueBuildInput {
  nodeEnv: string | undefined;
  /** Next passes the phase to the config: build, development or start. */
  phase: string | undefined;
  /** Result of the demo-seed rule for this build. */
  demoHidden: boolean;
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  /** Explicit opt-out for intentional credential-less preview builds. */
  allowEmpty: string | undefined;
}

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

function enabled(value: string | undefined): boolean {
  return TRUTHY.has((value ?? '').trim().toLowerCase());
}

/**
 * Returns the error message for a build that would ship an empty catalogue, or
 * `null` when the build is fine (development, non-build phase, credentials
 * present, seed visible, or explicitly allowed empty).
 */
export function productionCatalogueIssue(
  input: CatalogueBuildInput,
): string | null {
  if (input.nodeEnv !== 'production') return null;
  if (input.phase !== 'phase-production-build') return null;
  if (enabled(input.allowEmpty)) return null;
  if (!input.demoHidden) return null;
  if (input.supabaseUrl?.trim() && input.supabaseAnonKey?.trim()) return null;

  return [
    'Refusing to build an empty production catalogue.',
    'The demo seed is hidden in production and NEXT_PUBLIC_SUPABASE_URL /',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY are not set for this build, so every catalogue',
    'page would prerender zero listings and the CDN would cache that HTML.',
    'Set both variables for the build, or set NEXT_PUBLIC_HIDE_DEMO_LISTINGS=false',
    'to ship the demo seed on purpose. For an intentional credential-less preview',
    'build, set ALLOW_EMPTY_CATALOGUE=true.',
  ].join(' ');
}
