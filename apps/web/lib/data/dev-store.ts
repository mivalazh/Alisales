import type { ListingCardData } from './listings';
import { readJson, writeJson } from '../storage/demo-store';

/**
 * Local dev store — used whenever Supabase write credentials are absent
 * (fixture/demo mode, see lib/config/mode.ts). Lets a submitted listing appear
 * in the grid for end-to-end UX review, in development and on a production
 * preview build alike.
 *
 * Backed by the demo store (a JSON file on Node, isolate memory on Workers),
 * not by module-level variables: Next keeps a separate module graph per route,
 * so a plain array would not be shared between /api/listings and the page.
 * Wipe with `rm -rf apps/web/.dev-data` (or the `/tmp` fallback directory) to
 * reset the demo. Disabled when Supabase is configured or
 * `REQUIRE_HOSTED_SERVICES=true`.
 */

const FILE = 'listings.json';

function readAll(): ListingCardData[] {
  return readJson<ListingCardData[]>(FILE, () => []);
}

export function devListings(): ListingCardData[] {
  return readAll();
}

export function addDevListing(card: ListingCardData): void {
  const all = readAll();
  all.unshift(card);
  writeJson(FILE, all);
}

/**
 * Edit an existing dev listing (PATCH in fixture mode).
 * Returns false when the id is unknown so the route can answer 404.
 */
export function updateDevListing(id: string, patch: Partial<ListingCardData>): boolean {
  const all = readAll();
  const index = all.findIndex((l) => l.id === id);
  if (index < 0) return false;
  const current = all[index]!;
  all[index] = { ...current, ...patch };
  writeJson(FILE, all);
  return true;
}
