# Alisales — بازار آگهی خودرو

High-performance classifieds marketplace for new & used vehicles, launched on
**Kish Island**. Trust, transparency and a frictionless mobile-first UX are the
core product values. Showrooms subscribe for more listings and visibility;
individuals post free (up to **2 concurrent listings**). The owner's family
workshop attaches standardized, tamper-evident **inspection reports** — the
SHA-256 fingerprint of the canonical report content is stored on finalization
and shown on the public report card.

Strictly **Persian (فارسی)** UI: RTL layout, Jalali dates, Persian digits —
across navigation, buttons, forms, error messages, legal notices and dashboards.

## Stack

- **Web & SEO** — Next.js App Router + TypeScript + Tailwind (CSS variables
  from `@studio/design`), full RTL, mobile-first responsive (`sm:`/`md:`/`lg:`/`xl:`)
- **Mobile** — Expo (React Native) + TypeScript + Expo Router + React Query
- **Backend** — Supabase (Auth, Postgres + RLS, Storage, Edge Functions)
- **Validation** — Zod, shared via `@alisales/schemas` (web, mobile, functions)
- **Payments** — Zarinpal behind a modular `PaymentProvider` adapter (IDPay later)

## Design system (strict 60-30-10)

| Share | Role | Tokens |
| --- | --- | --- |
| **60%** neutral backgrounds | ice white `#F4F5F7`, pure white `#FFFFFF` | `color-surface`, `color-surface-subtle` |
| **30%** structure & typography | dark navy `#161224`, muted gray `#4A5568` | `color-text-primary`, `color-text-secondary`, `color-surface-inverse` |
| **10%** accent (CTAs only) | vibrant orange `#FF4000` | `color-accent`, `color-focus-ring` |

Rules locked by tests (`packages/design/tests/tokens.test.ts`):
- Orange is reserved for primary actions / "Post Listing" CTAs / key interactive
  elements — **navy label on orange** (WCAG AA, 6.1:1); no blue brand color exists.
- Tokens live in `tokens.ts` ⇄ `tokens.css` (parity-tested); badges keep fixed
  semantic colors; all text pairs pass WCAG AA.
- Motion stays minimal: bottom sheets 250 ms, press feedback only, 44 px minimum
  touch targets, photos 4:3 with lazy loading + skeleton placeholders.

## Brand assets (SVG)

`packages/design/logo/` — `logo-primary.svg` (horizontal lockup, dark 'A' +
orange accent), `logo-dark.svg` (dark backgrounds), `logo-symbol.svg` (rounded
'A' tile for app icons), `favicon.svg`. Programmatic markup via `LOGO` /
`logoSvgDocument()` from `@studio/design`.

## Localization policy

- All UI copy is Persian; `dir="rtl"` + `lang="fa"` at the document root
  (mobile forces RTL via `I18nManager`).
- Jalali dates and Persian digits come from the `@alisales/schemas` locale
  helpers (`src/locale.ts`): an arithmetic Jalali conversion that behaves
  identically on Node, browsers and React Native Hermes — proven against ICU's
  `fa-IR-u-ca-persian` calendar across a 45-year range in tests.
- **Validation messages are Persian platform-wide**: importing
  `@alisales/schemas` installs a Zod error map (`src/errors.ts`); custom
  refinements carry inline Persian text.

## Monorepo layout

```
packages/
  design/            @studio/design — 60-30-10 tokens (+CSS mirror), fixed
                     status-badge registry, SVG brand assets
  schemas/           @alisales/schemas — Zod: vehicle, listing (+photo rules),
                     subscription plans, inspection report form, search filters
                     + URL codec, plate-declaration copy (legal gate), Persian
                     error map + Persian locale (digits, IRR, Jalali dates)
  inspection-core/   canonical JSON + SHA-256 hashing + tamper verification
  payments/          PaymentProvider adapter: Zarinpal (IDPay stub reserved)
supabase/
  migrations/        0001 schema · 0002 functions/triggers · 0003 RLS · 0004 storage
  seed.sql           subscription plans (safe everywhere)
  seed_fixtures.sql  LOCAL/TEST ONLY demo accounts + listings
  functions/         edge functions (checkout, payment callback, inspection)
apps/
  web/               Next.js App Router — RTL shell (Vazirmatn), fixture-backed
                     listing grid + cards, create form, photo pipeline
                     (EXIF-strip → WebP → ≤20), POST /api/listings (shared-schema
                     400s in فارسی); SEO (JSON-LD, sitemap) lands in Phase 5
  mobile/            Expo Router + React Query — my-listings CRUD with state
                     transitions and free-quota paywall, plate-section form,
                     photo picker pipeline, demo store / RLS-gated Supabase
tests/               DB tests on PGlite (real Postgres in WASM — no Docker)
e2e/                 Playwright visual-regression snapshots
```

## Commands

```bash
npm install
npm test                 # all unit + DB (PGlite) tests
npm run typecheck        # every workspace
npm run smoke:db         # apply migrations+seeds on PGlite, sanity counts
npm run build            # next build (web) + workspace builds
npm run dev -w @alisales/web        # web dev server (:3000)
npm run start -w @alisales/mobile   # Expo dev server
npm run generate:icons   # rebuild PNG app icons from the SVG mark
node scripts/gen-covers.mjs   # rebuild the demo listing cover SVGs
```

**Offline demo modes** (no Supabase credentials needed, see `.env.example`):
the web app serves the seeded fixtures — the luxury Kish catalogue first, one
sold listing last — plus locally submitted listings (file store
`apps/web/.dev-data/`, moved to `/tmp/alisales-demo-data` when the filesystem is
read-only, wiped with `rm -rf`); the mobile app runs an in-memory demo store
with a visible «حالت نمایشی محلی» banner. With `NEXT_PUBLIC_SUPABASE_*` set, the
grid reads the shared `search_listings` RPC and mutations are RLS-gated.

**Demo / cloud-preview mode** (`apps/web/lib/config/mode.ts`): a production
build without Supabase write credentials keeps the same fixture store instead
of answering 503, and the login code is written to the server log. Set
`REQUIRE_HOSTED_SERVICES=true` to refuse that fallback, and
`NEXT_PUBLIC_DEMO_OTP_HINT=true` (preview builds only) to also show the code on
the OTP step so the owner can sign in on a shared preview link. Fixture cards
use the SVG illustrations in `apps/web/public/covers/`
(`node scripts/gen-covers.mjs` regenerates them).

## Product rules enforced in the database

- **Plans (PRICING GATE)** — individuals: **2 concurrent listings** free
  (drafts count; sold/expired/rejected free the slot); **basic** 8,000,000 IRR/mo
  → 10 listings, 1 featured slot, 1 free inspection, standard priority;
  **pro** 20,000,000 IRR/mo → 40 listings, 5 featured slots, 3 free inspections,
  priority search. Changing these requires legal/finance sign-off (tests lock them).
- **Lapsed showrooms** — listings hidden (`is_listing_public` requires a live
  subscription), never deleted; renewal restores them.
- **Rate limits** — 5 listing creations/hour/user, 30 messages/5 minutes.
- **Price anomaly** — ±40% from segment median → flagged + bounced to review.
- **Abuse** — ≥5 non-dismissed reports auto-hide the listing.
- **Plate types (PLATE GATE)** — `standard | kish | temporary_transit | unplated`.
  Kish and transit/un-plated vehicles get two distinct UI sections; the status
  is **seller-declared** («وضعیت پلاک توسط فروشنده اعلام می‌شود») — no forced
  legal disclaimer or police-inspection popup. Copy: `packages/schemas/src/legal.ts`.
- **Inspection reports** — append-only versions (immutable in the DB), SHA-256
  of canonical content stored at finalization, one finalized report per listing.

## Legal & finance gates (stop-and-ask)

| Gate | Location | Locked by |
| --- | --- | --- |
| Plan prices & limits | `supabase/seed.sql`, `packages/schemas/src/subscription.ts` | `packages/schemas/tests/subscription.test.ts` |
| Plate declaration copy | `packages/schemas/src/legal.ts` | `packages/schemas/tests/listing.test.ts` |
| 60-30-10 palette anchors | `packages/design/src/tokens.ts` | `packages/design/tests/tokens.test.ts` |

## Phase log

- [x] **Phase 1** — schema, RLS, hashing, tokens/badges/logos + tests
      (166 tests green; migrations on PGlite; full role matrix; plan-limit
      enforcement; search RPC; payment idempotency; golden-vector SHA-256;
      WCAG contrast; 60-30-10 palette lock; Persian error map)
- [x] **Phase 2** — listings for individuals with photo pipeline
      (190 tests green; Next 16 RTL grid + create form with shared-schema
      server validation; EXIF-strip → WebP → ≤20-photo client pipelines on web
      and mobile; Expo CRUD screens: quota paywall, state transitions, delete;
      branded icon set generated from the SVG mark; `next build`, dev-server
      HTTP smoke and Metro bundle export verified)
- [ ] Phase 3 — inspection report form + public report page
- [ ] Phase 4 — showroom accounts + subscriptions (Zarinpal edge functions)
- [ ] Phase 5 — search UI + SEO (JSON-LD, sitemap, canonical)
- [ ] Phase 6 — messaging + moderation
