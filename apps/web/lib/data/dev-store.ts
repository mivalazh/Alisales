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
/** Owner/admin edits to seeded fixture listings (they are read-only constants). */
const OVERRIDES = 'listing-overrides.json';

function readAll(): ListingCardData[] {
  return readJson<ListingCardData[]>(FILE, () => []);
}

type ListingPatch = Partial<ListingCardData>;

function readOverrides(): Record<string, ListingPatch> {
  return readJson<Record<string, ListingPatch>>(OVERRIDES, () => ({}));
}

export function devListings(): ListingCardData[] {
  return readAll();
}

/** Overrides saved for fixture listings (mark sold, pause, admin removal). */
export function listingOverrides(): Record<string, ListingPatch> {
  return readOverrides();
}

/** Merges persisted overrides into a mixed fixture/dev feed. */
export function applyListingOverrides<T extends ListingCardData>(listings: readonly T[]): T[] {
  const overrides = readOverrides();
  if (Object.keys(overrides).length === 0) return [...listings];
  return listings.map((listing) => {
    const patch = overrides[listing.id];
    return patch ? { ...listing, ...patch } : listing;
  });
}

export function addDevListing(card: ListingCardData): void {
  const all = readAll();
  all.unshift(card);
  writeJson(FILE, all);
}

/**
 * Edit a listing in fixture mode.
 *
 * Listings created here live in `listings.json`; the seeded fixtures are
 * constants, so their changes are stored as an override and merged on read
 * (otherwise «فروخته شد» and «بایگانی» silently did nothing).
 */
export function updateDevListing(id: string, patch: Partial<ListingCardData>): boolean {
  const all = readAll();
  const index = all.findIndex((l) => l.id === id);
  if (index >= 0) {
    const current = all[index]!;
    all[index] = { ...current, ...patch };
    writeJson(FILE, all);
    return true;
  }
  const overrides = readOverrides();
  overrides[id] = { ...(overrides[id] ?? {}), ...patch };
  writeJson(OVERRIDES, overrides);
  return true;
}
