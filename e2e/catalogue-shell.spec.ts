import { expect, test, type Page } from '@playwright/test';
import type { ListingCardData } from '../apps/web/lib/data/listings';

/**
 * Shell wiring for `/`, `/cars`, `/motorcycles`, `/heavy` and `/parts`.
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
 *  - a failed read, after which the static pool must still stand.
 */

const SEARCH = '**/api/listings/search*';
const RESULTS = '#listing-results';

/**
 * A card's stretched link, scoped to the grid (stories link to listings too).
 *
 * `/` streams a Suspense boundary, so its document carries the fallback and the
 * content at once (two `#listing-results` nodes). The duplicate is hidden and
 * goes away on hydration, but a count over the document would still see it — a
 * hidden copy is not a rendered card. Both helpers therefore match on
 * `:visible`: `resultCard` for "is it on screen", `visibleCards` for "is it
 * really gone".
 */
function visibleCards(page: Page, slug: string) {
  return page.locator(`${RESULTS} a[href="/listing/${slug}"]:visible`);
}

function resultCard(page: Page, slug: string) {
  return visibleCards(page, slug).first();
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
function vehicleRow(
  slug: string,
  category: NonNullable<ListingCardData['category']> = 'car',
): ListingCardData {
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
    category,
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
    // Home asks for the first page of the public pool: no category, no
    // narrowing, the hook's own page size.
    request: '/api/listings/search?limit=48',
    staticSlug: 'land-cruiser-kish',
    serverRow: vehicleRow('e2e-server-car'),
  },
  {
    name: 'cars',
    path: '/cars',
    request: '/api/listings/search?category=car&limit=48',
    staticSlug: 'land-cruiser-kish',
    serverRow: vehicleRow('e2e-server-car'),
  },
  {
    name: 'motorcycles',
    path: '/motorcycles',
    request: '/api/listings/search?category=motorcycle&limit=48',
    staticSlug: 'yamaha-mt09-kish',
    serverRow: vehicleRow('e2e-server-bike', 'motorcycle'),
  },
  {
    name: 'heavy',
    path: '/heavy',
    request: '/api/listings/search?category=heavy&limit=48',
    staticSlug: 'volvo-fh16-kish',
    serverRow: vehicleRow('e2e-server-heavy', 'heavy'),
  },
  {
    name: 'parts',
    path: '/parts',
    // The parts page asks for the pool and keeps parts client-side, exactly
    // like the home feed; the response is narrowed by `kind` after arrival, so
    // it is the whole-pool answer with no cursor.
    request: '/api/listings/search?limit=48',
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
      // The first request of the run compiles the route in a cold dev server;
      // the APIRequestContext default (30s) is not always enough on CI.
      const response = await request.get(spec.path, { timeout: 90_000 });
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

      // Opened so the gate can be released in `finally`: a failed assertion
      // must not leave the route handler pending across teardown. The catch is
      // attached in the same turn as the promise, so a slow run rejects into a
      // settled value instead of becoming an unhandled rejection (which fails
      // the worker, not just this test).
      const answered = page.waitForResponse(SEARCH, { timeout: 60_000 }).catch(() => null);
      try {
        await page.goto(spec.path, { waitUntil: 'domcontentloaded' });

        await expect(resultCard(page, spec.staticSlug)).toBeVisible();
      } finally {
        release();
        await answered;
      }
    });
  }
});

test.describe('request URL', () => {
  for (const spec of PAGES) {
    test(`${spec.name} asks for the canonical pool URL`, async ({ page }) => {
      const seen = recordSearchRequests(page);

      await page.goto(spec.path, { waitUntil: 'domcontentloaded' });

      // `requestedUrls` waits for the shell's own read: the prerendered pool is
      // already on screen, so its visibility proves nothing about the request.
      expect(await requestedUrls(seen)).toEqual([spec.request]);
    });
  }

  test('cars keys the request on ?body= narrowing', async ({ page }) => {
    const seen = recordSearchRequests(page);

    await page.goto('/cars?body=suv', { waitUntil: 'domcontentloaded' });

    expect(await requestedUrls(seen)).toEqual([
      '/api/listings/search?body=suv&category=car&limit=48',
    ]);
  });

  test('parts keys the request on its own attributes', async ({ page }) => {
    const seen = recordSearchRequests(page);

    await page.goto('/parts?origin=original', { waitUntil: 'domcontentloaded' });

    expect(await requestedUrls(seen)).toEqual([
      '/api/listings/search?limit=48&origin=original',
    ]);
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
      // Replacement, not append: the rendered pool is gone (visible copies
      // only — `/` keeps a hidden fallback node until hydration settles).
      await expect(visibleCards(page, spec.staticSlug)).toHaveCount(0);
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
      // Registered before the navigation (the answer can land during it) with
      // the rejection consumed immediately: an unobserved `waitForResponse`
      // timeout fails the worker, not just this test.
      const answered = page
        .waitForResponse(
          (response) => response.url().includes('/api/listings/search'),
          { timeout: 60_000 },
        )
        .catch(() => null);

      await page.goto(spec.path, { waitUntil: 'domcontentloaded' });
      await answered;

      await expect(resultCard(page, spec.staticSlug)).toBeVisible();
    });
  }
});
