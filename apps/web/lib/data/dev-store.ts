import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ListingCardData } from './listings';

/**
 * Local dev store — ONLY used when Supabase credentials are absent
 * (credential-less fixture mode, see .env.example). Lets a submitted listing
 * appear in the grid for end-to-end UX review.
 *
 * File-backed on purpose: Next (Turbopack) keeps a separate module graph per
 * route, so module-level memory would not be shared between /api/listings and
 * the page. Wipe with `rm -rf apps/web/.dev-data` to reset the demo; never
 * active when NEXT_PUBLIC_SUPABASE_* is set, and the API returns 503 for
 * submissions in production builds.
 */
const DATA_DIR = join(process.cwd(), '.dev-data');
const FILE = join(DATA_DIR, 'listings.json');

function readAll(): ListingCardData[] {
  try {
    if (!existsSync(FILE)) return [];
    const parsed: unknown = JSON.parse(readFileSync(FILE, 'utf8'));
    return Array.isArray(parsed) ? (parsed as ListingCardData[]) : [];
  } catch {
    return [];
  }
}

export function devListings(): ListingCardData[] {
  return readAll();
}

export function addDevListing(card: ListingCardData): void {
  mkdirSync(DATA_DIR, { recursive: true });
  const all = readAll();
  all.unshift(card);
  writeFileSync(FILE, `${JSON.stringify(all, null, 2)}\n`, 'utf8');
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
  writeFileSync(FILE, `${JSON.stringify(all, null, 2)}\n`, 'utf8');
  return true;
}
