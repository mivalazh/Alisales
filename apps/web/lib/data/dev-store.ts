import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ListingCardData } from './listings';
import { demoDataDir } from '../config/mode';

/**
 * Local dev store — used whenever Supabase write credentials are absent
 * (fixture/demo mode, see lib/config/mode.ts). Lets a submitted listing appear
 * in the grid for end-to-end UX review, in development and on a production
 * preview build alike.
 *
 * File-backed on purpose: Next (Turbopack) keeps a separate module graph per
 * route, so module-level memory would not be shared between /api/listings and
 * the page. Wipe with `rm -rf apps/web/.dev-data` (or the `/tmp` fallback
 * directory on a read-only preview) to reset the demo. Disabled when Supabase
 * is configured or `REQUIRE_HOSTED_SERVICES=true`.
 */
function storeFile(): string {
  return join(demoDataDir(), 'listings.json');
}

function readAll(): ListingCardData[] {
  try {
    const file = storeFile();
    if (!existsSync(file)) return [];
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? (parsed as ListingCardData[]) : [];
  } catch {
    return [];
  }
}

export function devListings(): ListingCardData[] {
  return readAll();
}

export function addDevListing(card: ListingCardData): void {
  const dir = demoDataDir();
  mkdirSync(dir, { recursive: true });
  const all = readAll();
  all.unshift(card);
  writeFileSync(join(dir, 'listings.json'), `${JSON.stringify(all, null, 2)}\n`, 'utf8');
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
  writeFileSync(storeFile(), `${JSON.stringify(all, null, 2)}\n`, 'utf8');
  return true;
}
