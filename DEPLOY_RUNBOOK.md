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
- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`) and
  `SUPABASE_SERVICE_ROLE_KEY` exported in the shell or secret store. Never paste
  the key into a command line you will share, and never commit it.
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

## 4. Key rotation

Rotate on a schedule, after any suspected exposure, or when someone with access
leaves. Rotate one key at a time and verify before moving on.

**Supabase service-role key** (server-only; never in the browser):

1. Dashboard → Project Settings → API → create a new service-role/JWT secret, or
   rotate the project's JWT secret if the old key must stop working immediately.
   Rotating the JWT secret also invalidates the anon key and every issued
   session — plan a sign-in announcement.
2. Update `SUPABASE_SERVICE_ROLE_KEY` in the host's secret store and redeploy.
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
