import {
  DEFAULT_AED_RATE,
  isPlausibleAedRate,
  tomanRateToIrr,
  type AedRate,
} from '@alisales/schemas';
import { readJson, writeJson } from '../storage/demo-store';

/**
 * The stored AED reference rate (server only).
 *
 * One value feeds every AED conversion in the product: cards, rows, the detail
 * page and the publish form's unit switch all read it through the rate
 * provider, so a rate edit can never leave one screen behind.
 *
 * Sources, in order:
 *  1. `settings.rate` — whatever the owner last saved from /admin/settings.
 *  2. The optional daily feed (`AED_RATE_FEED_URL`), cached for 24h. No public
 *     source quotes IRR reliably, so this is opt-in: without the env var the
 *     stored/admin value — or the launch reference — is what the site shows.
 *  3. `DEFAULT_AED_RATE` (272,000 rial / 27,200 toman per AED).
 *
 * `updatedAt` always travels with the number so «آخرین بروزرسانی» is the truth
 * of the value on screen rather than a fixed label.
 */

const FILE = 'settings.json';
const FEED_TTL_MS = 24 * 3_600_000;
const FEED_TIMEOUT_MS = 2_500;

interface SettingsFile {
  rate?: Partial<AedRate>;
}

function readSettings(): SettingsFile {
  return readJson<SettingsFile>(FILE, () => ({}));
}

function writeSettings(next: SettingsFile): void {
  writeJson(FILE, { ...readSettings(), ...next });
}

let cached: { value: AedRate; at: number } | null = null;
const CACHE_MS = 30_000;

function normalize(raw: Partial<AedRate> | undefined): AedRate | null {
  if (!raw || !isPlausibleAedRate(raw.aedToIrr)) return null;
  return {
    aedToIrr: raw.aedToIrr,
    updatedAt:
      typeof raw.updatedAt === 'string' && !Number.isNaN(Date.parse(raw.updatedAt))
        ? raw.updatedAt
        : new Date().toISOString(),
    source: raw.source === 'admin' || raw.source === 'auto' ? raw.source : 'default',
  };
}

/** The rate every screen uses, memoised briefly so one render is consistent. */
export async function getAedRate(): Promise<AedRate> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  const stored = normalize(readSettings().rate);
  const value = stored ?? (await autoRate()) ?? DEFAULT_AED_RATE;
  cached = { value, at: Date.now() };
  return value;
}

/** Admin-saved Toman-per-AED value (stored as rial). */
export async function setAedRate(tomanPerAed: number, source: 'admin' | 'auto'): Promise<AedRate> {
  const aedToIrr = tomanRateToIrr(tomanPerAed);
  if (!isPlausibleAedRate(aedToIrr)) {
    throw new Error('invalid rate');
  }
  const value: AedRate = { aedToIrr, updatedAt: new Date().toISOString(), source };
  writeSettings({ rate: value });
  cached = { value, at: Date.now() };
  return value;
}

/**
 * Optional daily FX refresh.
 *
 * Returns the stored rate untouched unless `AED_RATE_FEED_URL` is configured
 * and the cached auto value is older than a day. The feed must answer
 * `{ "aedToIrr": 272000 }`, `{ "rate": 272000 }` or a bare number — rial per
 * AED, exactly like the stored value.
 */
async function autoRate(): Promise<AedRate | null> {
  const url = process.env.AED_RATE_FEED_URL;
  if (!url) return null;

  const stored = normalize(readSettings().rate);
  const fresh = stored && Date.now() - Date.parse(stored.updatedAt) < FEED_TTL_MS;
  if (stored && stored.source !== 'admin' && fresh) return stored;
  if (stored?.source === 'admin') return stored; // an owner value always wins

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return stored;
    const body: unknown = await response.json();
    const raw =
      typeof body === 'number'
        ? body
        : (body as { aedToIrr?: unknown; rate?: unknown }).aedToIrr ??
          (body as { rate?: unknown }).rate;
    const numeric = typeof raw === 'string' ? Number(raw) : raw;
    if (!isPlausibleAedRate(numeric)) return stored;
    return await setAedRate(numeric / 10, 'auto');
  } catch {
    // Offline, timeout, malformed body — the stored value stays authoritative.
    return stored;
  }
}

/** Test hook: drop the memoised value (the admin save path does it itself). */
export function resetRateCache(): void {
  cached = null;
}
