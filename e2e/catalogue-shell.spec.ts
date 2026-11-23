import { expect, test, type Page } from '@playwright/test';
import type { ListingCardData } from '../apps/web/lib/data/listings';

/**
 * Shell wiring for `/`, `/cars` and `/parts`.
 *
 * Each page is statically generated with a real pool, so the first paint must
 * already carry cards — before any JavaScript, and even when the follow-up read
 * fails. After hydration the hook asks `/api/listings/search` for the URL's
 * full matching pool and swaps it in. These specs pin all three behaviours:
 *
 *  - the request URL (the canonical key the route expects, filter narrowing
 *    included), so a shell can never fetch an unscoped pool again;
 *  - the static first paint: the pool is in the document, and on screen while
 *    the follow-up read is still in flight;
 *  - the swap to server rows, which must replace the static rows, not append;
 *  - a failed or aborted read, after which the static pool must still stand.
 */

const SEARCH = '**/api/listings/search*';
const RESULTS = '#listing-results';

/**
 * A card's stretched link, scoped to the grid (stories link to listings too).
 *
 * The prerendered HTML can hold the Suspense fallback and the streamed content
 * at the same time, so visibility checks use the visible match; absence checks
 * use `resultCards(...)` and count instead.
 */
function resultCards(page: Page, slug: string) {
  return page.locator(`${RESULTS} a[href="/listing/${slug}"]`);
}

function resultCard(page: Page, slug: string) {
  return page.locator(`${RESULTS} a[href="/listing/${slug}"]:visible`).first();
}

function cards(page: Page) {
  return page.locator(`${RESULTS} a[href^="/listing/"]:visible`);
}

/** Path + query of an absolute URL — what the cache key and the route see. */
function pathAndQuery(url: string): string {
  const parsed = new URL(url);
  return parsed.pathname + parsed.search;
}

/**
 * Records every catalogue request. A dev-mode render double-invokes the effect
 * (React StrictMode aborts the first one), so callers compare the *set* of
 * URLs, never the count.
 */
function recordSearchRequests(page: Page): string[] {
  const seen: string[] = [];
  void page.route(SEARCH, async (route) => {
    seen.push(route.request().url());
    await route.continue();
  });
  return seen;
}

async function requestedUrls(seen: string[]): Promise<string[]> {
  await expect.poll(() => new Set(seen.map(pathAndQuery)).size).toBeGreaterThan(0);
  return [...new Set(seen.map(pathAndQuery))];
}

/** A vehicle row shaped like the RPC's answer, distinct from every fixture. */
function vehicleRow(slug: string): ListingCardData {
  return {
    id: `e2e-${slug}`,
    slug,
    sellerId: 'e2e-seller',
    priceIRR: 12_000_000_000,
    city: 'kish',
    state: 'active',
    featured: false,
    publishedAt: new Date().toISOString(),
    hasReport: false,
    brand: 'toyota',
    model: 'Prado',
    trim: 'VX',
    year: 2021,
    mileageKm: 40_000,
    gearbox: 'automatic',
    fuel: 'petrol',
    color: 'white',
    condition: 'used',
    plateType: 'kish',
    coverUrl: null,
    photos: [],
    showroomName: null,
    showroomVerified: false,
    allowPhoneReveal: false,
    kind: 'vehicle',
    category: 'car',
    bodyType: 'suv',
  } as ListingCardData;
}

/** A part row; `/parts` filters the answer by kind, so the payload must say so. */
function partRow(slug: string): ListingCardData {
  return {
    ...vehicleRow(slug),
    id: `e2e-${slug}`,
    brand: '',
    model: 'E2E Brake Pads',
    trim: null,
    year: 0,
    mileageKm: 0,
    condition: 'new',
    plateType: 'unplated',
    kind: 'part',
    part: {
      title: 'E2E Brake Pads',
      category: 'brake',
      origin: 'original',
      condition: 'new',
      partNumber: null,
      compatibility: 'Toyota Prado',
      warranty: null,
    },
  } as ListingCardData;
}

const PAGES = [
  {
    name: 'home',
    path: '/',
    // Home asks for the whole public pool: no category, no narrowing.
    request: '/api/listings/search',
    staticSlug: 'land-cruiser-kish',
    serverRow: vehicleRow('e2e-server-car'),
  },
  {
    name: 'cars',
    path: '/cars',
    request: '/api/listings/search?category=car',
    staticSlug: 'land-cruiser-kish',
    serverRow: vehicleRow('e2e-server-car'),
  },
  {
    name: 'parts',
    path: '/parts',
    // The parts page asks for the pool and keeps parts client-side, exactly
    // like the home feed; the response is narrowed by `kind` after arrival.
    request: '/api/listings/search',
    staticSlug: 'cayenne-brake-kit-part',
    serverRow: partRow('e2e-server-part'),
  },
] as const;

test.describe('static first paint', () => {
  for (const spec of PAGES) {
    // The document itself — what the CDN and a crawler receive, with no script
    // executed. A JS-disabled browser is no good here: Next dev injects its
    // stylesheet through the client runtime, so an unstyled page has no boxes
    // to assert visibility on. The markup is the honest source.
    test(`${spec.name} ships its pool in the prerendered HTML`, async ({ request }) => {
      const response = await request.get(spec.path);
      expect(response.status()).toBe(200);

      const html = await response.text();
      expect(html).toContain('id="listing-results"');
      expect(html).toContain(`href="/listing/${spec.staticSlug}"`);
      // A populated grid, not one stray link: the stories rail alone has fewer.
      expect(html.match(/href="\/listing\//g)?.length ?? 0).toBeGreaterThan(4);
    });

    // And those rows are on screen before the server answer can arrive: the
    // read is held open, and the static pool is still what the buyer sees.
    test(`${spec.name} paints the static rows before the answer lands`, async ({ page }) => {
      let release = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route(SEARCH, async (route) => {
        await gate;
        await route.continue();
      });

      await page.goto(spec.path, { waitUntil: 'domcontentloaded' });

      await expect(resultCard(page, spec.staticSlug)).toBeVisible();
      expect(await cards(page).count()).toBeGreaterThan(0);
      release();
    });
  }
});

test.describe('request URL', () => {
  for (const spec of PAGES) {
    test(`${spec.name} asks for the canonical pool URL`, async ({ page }) => {
      const seen = recordSearchRequests(page);

      await page.goto(spec.path, { waitUntil: 'domcontentloaded' });

      // The swap landed, so the request the shell made is the one under test.
      await expect(cards(page).first()).toBeVisible();
      expect(await requestedUrls(seen)).toEqual([spec.request]);
    });
  }

  test('cars keys the request on ?body= narrowing', async ({ page }) => {
    const seen = recordSearchRequests(page);

    await page.goto('/cars?body=suv', { waitUntil: 'domcontentloaded' });

    expect(await requestedUrls(seen)).toEqual(['/api/listings/search?body=suv&category=car']);
  });

  test('parts keys the request on its own attributes', async ({ page }) => {
    const seen = recordSearchRequests(page);

    await page.goto('/parts?origin=original', { waitUntil: 'domcontentloaded' });

    expect(await requestedUrls(seen)).toEqual(['/api/listings/search?origin=original']);
  });
});

test.describe('server-row swap', () => {
  for (const spec of PAGES) {
    test(`${spec.name} replaces the static rows with the server answer`, async ({ page }) => {
      await page.route(SEARCH, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ rows: [spec.serverRow] }),
        }),
      );

      await page.goto(spec.path, { waitUntil: 'domcontentloaded' });

      await expect(resultCard(page, spec.serverRow.slug)).toBeVisible();
      // Replacement, not append: the rendered pool is gone.
      await expect(resultCards(page, spec.staticSlug)).toHaveCount(0);
    });
  }
});

test.describe('failed read keeps the static pool', () => {
  for (const spec of PAGES) {
    test(`${spec.name} keeps its cards after a 503`, async ({ page }) => {
      await page.route(SEARCH, (route) =>
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'e2e: read down' }),
        }),
      );
      const answered = page.waitForResponse((response) =>
        response.url().includes('/api/listings/search'),
      );

      await page.goto(spec.path, { waitUntil: 'domcontentloaded' });
      await answered;

      await expect(resultCard(page, spec.staticSlug)).toBeVisible();
      expect(await cards(page).count()).toBeGreaterThan(0);
    });
  }
});

test.describe('aborted read keeps the static pool', () => {
  for (const spec of PAGES) {
    test(`${spec.name} keeps its cards when the request is aborted`, async ({ page }) => {
      await page.route(SEARCH, (route) => route.abort());
      const failed = page.waitForEvent('requestfailed', (request) =>
        request.url().includes('/api/listings/search'),
      );

      await page.goto(spec.path, { waitUntil: 'domcontentloaded' });
      await failed;

      await expect(resultCard(page, spec.staticSlug)).toBeVisible();
      expect(await cards(page).count()).toBeGreaterThan(0);
    });
  }
});
