# Alisales mobile (Expo)

React Native (Expo SDK 58) + Expo Router + React Query client for the Alisales
classifieds marketplace. Persian-first: RTL is forced app-wide via
`I18nManager`, all copy is فارسی, dates/digits come from the
`@alisales/schemas` locale helpers (Hermes-safe arithmetic Jalali conversion).

## What's here (Phase 2)

- **`src/app/`** — file-based routes:
  - `index.tsx` — «آگهی‌های من»: my-listings with state transitions
    (draft → pending_review → active → paused → sold), delete (with confirm),
    free-quota notice and the 2-free-listing paywall
  - `listing/new.tsx` — create (blocked once the free plan's 2 slots are used;
    the DB trigger enforces the same rule server-side)
  - `listing/[id].tsx` — edit, hydrated from the stored payload
- **`src/components/`** — `ListingForm` (shared schema validation with inline
  Persian errors, dedicated seller-declared plate section) and `PhotoStrip`
  (cover ordering, removal, ≤ 20 photos)
- **`src/lib/photos.ts`** — picker → downscale (max edge 1600) → WebP re-encode
  (EXIF dropped by construction) → ≤ 8 MB enforcement
- **`src/lib/api.ts`** — React Query data layer. With no
  `EXPO_PUBLIC_SUPABASE_*` env vars it runs an in-memory demo store (visible
  «حالت نمایشی محلی» banner, wiped on app restart); with credentials it reads
  and writes the real tables under RLS — mutations need a signed-in session
  (auth lands in Phase 4), so pre-auth failures surface as Persian messages
- **`src/lib/theme.ts`** — `@studio/design` tokens mapped to React Native
  (RN can't read CSS custom properties, so the JS token object is the source)

## Environment and store builds

Set these in the shell or in an untracked `.env` before `expo start` / EAS:

```bash
EXPO_PUBLIC_API_URL=https://alisales.ir      # public web origin
EXPO_PUBLIC_SUPABASE_URL=...                 # optional; without both Supabase vars the app runs its local demo store
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

The app is RTL-first (`I18nManager.forceRTL`), declares `ir.alisales.app` on
iOS and Android, version `1.0.0` / build `1` in `app.json`, and keeps the same
scheme (`alisales://`) in Expo Go and production builds. `eas.json` provides
`preview` and `production` profiles:

```bash
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
npx eas submit --platform ios --profile production
```

## Commands

```bash
npm install                      # from the repo root
npm run start -w @alisales/mobile   # Expo dev server
npm run typecheck -w @alisales/mobile
npm run generate:icons           # rebuild assets/images/*.png from the SVG mark
npx eas build --platform ios --profile production   # TestFlight build
npx eas build --platform android --profile production
npx expo export --platform android   # Metro bundle check (Hermes)
```

Assets (`assets/images/`) are generated from `packages/design/logo/` — never
edit the PNGs by hand; re-run `npm run generate:icons`.
