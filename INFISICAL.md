# Secrets — Infisical

Secrets manager in use: none

Local secrets for Alisales live in Infisical and are injected at process start:

```bash
infisical run --env=dev -- <command>
```

Nothing in the app changes: packages, edge functions and scripts keep reading
the same variable names from `process.env` (or the Supabase runtime), and a
variable supplied by `infisical run` wins over the same key in a local `.env`.

## Commands

| Scope | Command |
| --- | --- |
| Local dev (wrapped) | `npm run dev` → `infisical run --env=dev -- supabase start` |
| Build / test / typecheck (unchanged) | `npm run build`, `npm test`, `npm run typecheck`, `npm run smoke:db` |

`supabase start` is the repo's local dev entry point: it brings up the local
Supabase stack (API `:54321`, Postgres `:54322`, Studio `:54323`) from
`supabase/config.toml`, which the web app, edge functions and payments callback
talk to. Tests and `smoke:db` run migrations on PGlite and need no Docker, so
they stay outside Infisical. Production entry points (build output, containers,
CI) are intentionally not wrapped: they authenticate with a machine identity,
not the dev CLI.

## Environment variables read by the app

Names only — values live in Infisical, never in git.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `ZARINPAL_MERCHANT_ID`
- `ZARINPAL_MODE`

`.env.example` lists the same names with empty or placeholder values and is the
one env file that stays tracked.

## Finish setup

1. Create a project for this service in the Infisical dashboard (Development /
   Staging / Production environments come with it).
2. Install the CLI: macOS `brew install infisical/get-cli/infisical`; Windows
   `scoop bucket add org https://github.com/Infisical/scoop-infisical.git` then
   `scoop install infisical`; anywhere with npm `npm install -g @infisical/cli`.
   (Docs: https://infisical.com/docs/cli/overview)
3. `infisical login` — on WSL 2, Codespaces or a headless SSH box use
   `infisical login -i`.
4. `infisical init` in this folder — writes `.infisical.json` with the project
   id. It holds no secrets and is safe to commit.
5. In the project's **Secrets Overview**, pick the `dev` environment and drag
   your existing `.env` onto the page: every key is imported in one go.
6. `npm run dev` (i.e. `infisical run --env=dev -- supabase start`) and check
   the stack comes up with the injected values.
7. Move `.env` OUT of the repository folder (for example `mv .env ~/alisales.env.bak`).
   Do not rename it to a backup name inside the repo — git would not ignore it.
   Restart `npm run dev`: values now come only from Infisical.
8. Optionally run `infisical scan` to check history for leaked secrets.

CI and production need a **machine identity** with Universal Auth
(`INFISICAL_UNIVERSAL_AUTH_CLIENT_ID` / `INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET`
held in the platform's own secret store), not the interactive dev login.

Any secret that was ever committed stays in git history: rotate it in Infisical
(and at the provider — Supabase keys, Zarinpal merchant id) instead of only
deleting the file.
