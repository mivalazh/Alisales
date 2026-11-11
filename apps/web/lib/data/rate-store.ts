import {
  AED_PER_USD,
  DEFAULT_AED_RATE,
  isPlausibleAedRate,
  isPlausibleAedRateToman,
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
 *  1. `settings.rate` — whatever the owner last saved from the external admin tool.
 *  2. A live free-market source: optional `AED_RATE_FEED_URL`, Navasan when a
 *     key exists, otherwise Nobitex USDT/IRT ÷ 3.6725. Automatic values cache
 *     for six hours and failures back off for fifteen minutes.
 *  3. `DEFAULT_AED_RATE` (272,000 rial / 27,200 toman per AED).
 *
 * `updatedAt` always travels with the number so «آخرین بروزرسانی» is the truth
 * of the value on screen rather than a fixed label.
 */

const FILE = 'settings.json';
/** An automatic value younger than this is reused without a network call. */
const FEED_TTL_MS = 6 * 3_600_000;
const FEED_TIMEOUT_MS = 3_000;
/** A failed fetch backs off for this long so a dead API cannot stall renders. */
const FAILURE_BACKOFF_MS = 15 * 60_000;

/** Tether is the market's dollar proxy; dirhams are pegged at 3.6725/USD. */
const NOBITEX_USDT_IRT = 'https://apiv2.nobitex.ir/v3/orderbook/USDTIRT';
const NAVASAN_LATEST = 'https://api.navasan.tech/latest/';

let feedFailedAt = 0;

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
 * Automatic FX refresh from the live market.
 *
 * Order of preference:
 *  1. `AED_RATE_FEED_URL` — an owner-supplied JSON feed (`aedToIrr`/`rate` in
 *     rial, or a bare number).
 *  2. Navasan (`api.navasan.tech/latest/?api_key=…`) when `NAVASAN_API_KEY` is
 *     set — a dirham quote in Toman.
 *  3. Nobitex USDT/IRT last price ÷ 3.6725 — the Tether-linked fallback that
 *     needs no key, so a fresh install still gets a market-derived number.
 *
 * Every candidate goes through the 15,000–60,000 Toman window before it is
 * stored: `0`, `NaN`, a rial/Toman mix-up or a stale quote keeps the previous
 * (or default) rate instead of poisoning every price on the site. A failed
 * fetch backs off for 15 minutes so a dead API cannot slow each render.
 */
async function autoRate(): Promise<AedRate | null> {
  const stored = normalize(readSettings().rate);
  if (stored?.source === 'admin') return stored; // an owner value always wins
  if (stored && stored.source === 'auto') {
    if (Date.now() - Date.parse(stored.updatedAt) < FEED_TTL_MS) return stored;
  }
  if (Date.now() - feedFailedAt < FAILURE_BACKOFF_MS) return stored;

  const toman = await fetchLiveToman();
  if (!isPlausibleAedRateToman(toman)) {
    feedFailedAt = Date.now();
    return stored;
  }
  return await setAedRate(toman, 'auto');
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return (await response.json()) as unknown;
}

/** Toman per 1 AED, or null when no source answered a plausible number. */
async function fetchLiveToman(): Promise<number | null> {
  const custom = process.env.AED_RATE_FEED_URL;
  if (custom) {
    try {
      const body = await getJson(custom);
      const raw =
        typeof body === 'number'
          ? body
          : (body as { aedToIrr?: unknown; rate?: unknown } | null)?.aedToIrr ??
            (body as { rate?: unknown } | null)?.rate;
      const rial = typeof raw === 'string' ? Number(raw) : raw;
      if (isPlausibleAedRate(rial)) return rial / 10;
    } catch {
      // fall through to the next source
    }
  }

  const navasanKey = process.env.NAVASAN_API_KEY;
  if (navasanKey) {
    try {
      const body = await getJson(`${NAVASAN_LATEST}?api_key=${encodeURIComponent(navasanKey)}`);
      const entry = (body as Record<string, { value?: unknown } | undefined> | null)?.['aed'];
      const raw = typeof entry?.value === 'string' ? Number(entry.value) : entry?.value;
      // Navasan quotes free-market Toman; a >200k answer is a rial value.
      const toman = typeof raw === 'number' && raw > 200_000 ? raw / 10 : raw;
      if (isPlausibleAedRateToman(toman)) return toman;
    } catch {
      // fall through to Tether
    }
  }

  try {
    const body = await getJson(NOBITEX_USDT_IRT);
    const book = body as
      | {
          lastTradePrice?: unknown;
          last?: unknown;
          bids?: unknown[][];
          asks?: unknown[][];
        }
      | null;
    const raw =
      book?.lastTradePrice ??
      book?.last ??
      book?.bids?.[0]?.[0] ??
      book?.asks?.[0]?.[0];
    const irtPerUsdt = typeof raw === 'string' ? Number(raw) : raw;
    if (typeof irtPerUsdt !== 'number' || !Number.isFinite(irtPerUsdt) || irtPerUsdt <= 0) {
      return null;
    }
    // Nobitex has quoted this pair in both rial and Toman over its lifetime;
    // anything above 500k is unmistakably rial. Normalise to Toman, then
    // divide the USD/AED peg (3.6725) to get the free-market dirham rate.
    const usdtToman = irtPerUsdt > 500_000 ? irtPerUsdt / 10 : irtPerUsdt;
    const toman = usdtToman / AED_PER_USD;
    return isPlausibleAedRateToman(toman) ? Math.round(toman) : null;
  } catch {
    return null;
  }
}

/** Force a market refresh from the admin panel; returns the new stored rate. */
export async function refreshAedRate(): Promise<AedRate> {
  feedFailedAt = 0;
  const toman = await fetchLiveToman();
  if (!isPlausibleAedRateToman(toman)) {
    feedFailedAt = Date.now();
    throw new Error('invalid rate');
  }
  return setAedRate(toman, 'auto');
}

/** Test hook: drop the memoised value (the admin save path does it itself). */
export function resetRateCache(): void {
  cached = null;
}
