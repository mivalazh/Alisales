import { defineConfig, devices } from '@playwright/test';

/**
 * Browser coverage for the catalogue shells.
 *
 * The shells are the one part of the catalogue that unit tests cannot prove:
 * the server renders a static pool, and after hydration a client hook replaces
 * it with the full matching answer (or leaves the static pool alone when the
 * read fails). These specs drive the real dev server — seeded fixture
 * catalogue, no Supabase credentials — and assert both sides of that swap.
 *
 * `e2e/` is excluded from the vitest config, so these run only here (and in the
 * CI `e2e` job).
 */
const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // The dev server compiles routes on demand; the first navigation is slow.
  timeout: 90_000,
  expect: { timeout: 20_000 },
  // One worker: every spec shares the one dev server, and a serial run keeps
  // the request/response assertions readable when something fails.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev --workspace @alisales/web -- --port ${PORT} --hostname 127.0.0.1`,
    url: BASE_URL,
    // Locally, a dev server already on this port is reused; CI always starts
    // a fresh one, so the run can never test an older build. A dev server on
    // some *other* port does not help: Next 16 allows one per app directory and
    // this one exits with "Another next dev server is already running" — stop
    // yours before running the suite.
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      // Fixture mode: the same catalogue CI and a credential-less deployment
      // serve. Empty values win over any `.env.local` in the checkout.
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
    },
  },
});
