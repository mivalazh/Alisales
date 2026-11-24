# Deploy runbook

The release path for Ali Sales, written so someone other than the original
author can follow it. Applies migrations → buckets → preflight → app → verify,
with a rollback that does not lose data.

`npm run preflight` is the gate: it checks the live Supabase project against
[`scripts/preflight-manifest.mjs`](scripts/preflight-manifest.mjs) (every table,
view, column and RPC each migration creates, plus the storage buckets and their
public/private flags) and exits non-zero when anything is missing. It is
read-only — no rows or objects are written.

## 0. Before you start

- Supabase CLI linked to the project: `supabase link --project-ref <ref>`
  (`supabase/config.toml` pins `project_id = "alisales"`).
- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`) and the server key exported in
  the shell or secret store. The app accepts either name — the legacy
  `SUPABASE_SERVICE_ROLE_KEY` or Supabase's newer `SUPABASE_SECRET_KEY` — and
  reports whichever it found in `/api/health`. Never paste the key into a
  command line you will share, and never commit it.
- Know the **current** release: record the git SHA you are deploying from and
  the one you are replacing. Rollback needs both.

## 1. Apply migrations

```bash
git pull                      # the release commit
supabase migration list       # see local vs remote versions
supabase db push              # apply pending migrations to the linked project
supabase migration list       # confirm: no local version is missing remotely
```

Rules:

- Migrations are additive and forward-only. Do not edit a migration that has
  already been applied to the project — add a new one.
- `db push` asks before destructive statements; read the prompt, do not answer
  blindly.
- If a migration fails halfway, the transaction is rolled back and the project
  stays on the previous version. Fix the migration, then push again; do not
  hand-edit the remote schema to "catch up".

## 2. Storage buckets

Migrations create the buckets (`0004_storage.sql`: `listing-photos`,
`report-photos`, `showroom-licenses`; `0011_profile_story_media.sql`:
`profile-media`, `story-media`), but a project created outside the migration
path may still be missing one. Verify, and create only what is missing:

```bash
npm run preflight             # lists every missing bucket by name
```

Dashboard → Storage → New bucket, with the exact id and access flag:

| Bucket | Public | Used for |
| --- | --- | --- |
| `listing-photos` | yes | listing cover/gallery images |
| `report-photos` | yes | inspection report photos |
| `showroom-licenses` | **no** | private licence uploads |
| `profile-media` | yes | avatars and cover banners |
| `story-media` | yes | story images and clips |

A wrong public flag is a data leak (`showroom-licenses`) or a broken image path
(everything else), so the preflight fails on a mismatch rather than only on a
missing bucket.

## 3. Preflight, then deploy

```bash
# Either name works for the key (SUPABASE_SECRET_KEY for a newer secret key).
SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
npm run preflight
```

Expect `[preflight] OK — … checks passed`. Only then deploy the app commit.
`/api/health` on the deployed origin is the second gate: it round-trips one row
through `public.health_probes` and one object through `listing-photos`, and
reports `check.database` / `checks.storage` separately. 503 always names the
failing piece.

After the app is live:

```bash
npm run auth:e2e -- --url=https://<host>     # real SMS login, session, logout
```

### Demo seed in previews and production

The seeded Kish catalogue (`seed_fixtures.sql`, rendered from
`apps/web/lib/data/fixtures.ts`) is review content, not inventory. One switch
controls it — `NEXT_PUBLIC_HIDE_DEMO_LISTINGS` — and the default deliberately
depends on how the app was started, not on the host name:

| Where | Seed served by default? | Why |
| --- | --- | --- |
| **Production build** (`npm run build` + `next start`, or any hosted deployment built for production, including a preview URL) | **No** | Real visitors must never see sample sellers or listings. Only rows in Supabase or the dev store appear. |
| **`next dev`** (local or chat preview) | **Yes** | A dev preview without Supabase credentials would otherwise be an empty catalogue; the seed is the content being reviewed. |

So a preview deployment is only seed-free if it was built with `next build`;
the seed you see while reviewing is served by the dev server. To check the
launch view with the production default locally:

```bash
NEXT_PUBLIC_HIDE_DEMO_LISTINGS=true npm run dev -w @alisales/web
```

Without hosted credentials the catalogue is then empty — that is the proof that
nothing seeded is being served, not a bug.

To publish the seed on purpose (a demo or showroom build), set the flag before
building and deploying:

```bash
NEXT_PUBLIC_HIDE_DEMO_LISTINGS=false npm run build -w @alisales/web
```

Any non-empty value other than `false`, `0`, `no` or `off` hides the seed, and
`true` is the explicit production setting. Set the value in the deployment's
environment before the build/deploy; do not rely on flipping it at runtime.

**The build refuses to ship an empty catalogue.** Two guards cover it, because
credentials in the environment are not proof that the read works:

- `next.config.ts` fails the build when the seed is hidden and
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing at
  build time (“Refusing to build an empty production catalogue.”). Both values
  must be present for the build itself, not only at runtime, because the routes
  are statically generated.
- The catalogue read fails the build when it returns no rows — or throws —
  while pages prerender (“Refusing to prerender an empty … catalogue”). A wrong
  or expired anon key, an unreachable project or unapplied migrations look
  exactly like this: the read falls back to the seed, which is hidden in
  production, so every page would cache empty HTML. One category may be empty
  while the catalogue is not; only an empty catalogue or a failed read fails.

An intentional empty build — a credential-less preview, or a brand-new
marketplace with no rows yet — must set `ALLOW_EMPTY_CATALOGUE=true`; never on a
real deployment. Both guards are build-time only: a running site with
credentials and zero rows stays up, and is a legitimate empty marketplace.

### Where each build gets its environment

The two `NEXT_PUBLIC_SUPABASE_*` values must be present **during the build**,
not only at runtime: Next inlines `NEXT_PUBLIC_*`, and the catalogue is read
while the bundle is produced. Every path that produces the shipped bundle
builds from a checkout:

| Build | Runs | Sees | Credential-less? |
| --- | --- | --- | --- |
| GitHub Actions (`ci.yml`) | `npm run build` in the checkout | the workflow `env` only | yes — the build step sets `ALLOW_EMPTY_CATALOGUE=true`; it is a compile check, not a deploy |
| Freebuff Sites publish | `sites_prepare_next` runs the OpenNext `next build` in this checkout, then `sites_deploy` uploads the bundle | the checkout's shell and `apps/web/.env.*` (Next loads them before `next.config.ts`) | yes by default — the gitignored `apps/web/.env.production.local` sets `ALLOW_EMPTY_CATALOGUE=true` |
| `next start` / `npm run dev` | the built bundle / the dev server | runtime environment | n/a — neither phase can trip either guard |

To publish a preview against a real project instead of an empty catalogue, add
both public values to `apps/web/.env.production.local` (or export them in the
shell that runs the publish) and remove `ALLOW_EMPTY_CATALOGUE`; the build then
reads the live catalogue and the refusal stays armed. Never commit that file or
put keys in it — it is gitignored for that reason.

## 4. Key rotation

Rotate on a schedule, after any suspected exposure, or when someone with access
leaves. Rotate one key at a time and verify before moving on.

**Supabase service-role key** (server-only; never in the browser):

1. Dashboard → Project Settings → API → create a new service-role/JWT secret, or
   rotate the project's JWT secret if the old key must stop working immediately.
   Rotating the JWT secret also invalidates the anon key and every issued
   session — plan a sign-in announcement.
2. Update the server key in the host's secret store and redeploy — whichever
   name that deployment uses, `SUPABASE_SERVICE_ROLE_KEY` or
   `SUPABASE_SECRET_KEY`.
3. `npm run preflight` and `GET /api/health` must pass with the new key.
4. Revoke the old key.

**Anon key**: same flow for `NEXT_PUBLIC_SUPABASE_ANON_KEY`; it is public, so
the only requirement is that the deployed build uses the new value.

**`AUTH_SECRET`** (session cookie signing, ≥16 chars):

1. Set the new value and redeploy. **Every existing session becomes invalid**;
   users sign in again.
2. Verify sign-in end to end with `npm run auth:e2e`.

**SMS.ir / provider keys**: replace `SMS_IR_API_KEY` (or the generic trio) in
the secret store, redeploy, send one real code.

**Payment merchant id**: replace `ZARINPAL_MERCHANT_ID`, redeploy, run one
sandbox payment.

## 5. Rollback

The app rolls back independently of the database, because migrations are
additive.

**App only (normal case)** — the previous build still runs against the new
schema:

1. Find the last good release SHA (`git log --oneline`).
2. Deploy that SHA/tag through the host's normal path (or revert the release
   commit and push).
3. `GET /api/health` → 200, then `npm run auth:e2e`.

**Schema** — only if a migration itself is wrong and you cannot wait for a
forward fix:

- Preferred: write a new corrective migration, `supabase db push` it, redeploy.
- Emergency: `supabase db reset` against the **local** database only. Never
  reset a production project: it drops data.
- Restoring production data is a Supabase backup/PITR operation, not a CLI
  command. Confirm the current restore point in the dashboard before touching
  anything.

**Bad release checklist**

- [ ] Is `/api/health` failing? Its `checks` name the broken dependency
      (`database`, `storage`, `authSecret`, `login`, `sms`).
- [ ] Did the migration apply? `supabase migration list`.
- [ ] Are buckets present with the right flag? `npm run preflight`.
- [ ] Did keys change? Re-run preflight and a real login.
- [ ] Rolled back? Re-run preflight and `auth:e2e` on the rolled-back build.

## 6. What is deliberately not automated

- No CI deploy step: CI has no project secrets, and a database migration should
  not run unattended from a pull request.
- No automatic `db reset`, `db push --include-all`, or destructive SQL on
  production.
- No key rotation automation: rotating the JWT secret signs everyone out, which
  is a product decision, not a cron job.
