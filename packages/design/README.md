# @studio/design

Single source of truth for the Alisales visual language:

- `src/tokens.ts` ⇄ `src/tokens.css` — Palette A tokens (canonical `light` /
  `dark` key names, mirrored 1:1 as CSS custom properties; parity-tested).
- `src/status.ts` — five approved core badges + seven lifecycle badge entries,
  `tagsForListing()` card-tag semantics, `lifecycleTagFor()` state mapping
  (`sold` → no lifecycle tag).
- `src/icons.ts` — 36-icon shared registry (24×24, 1.5 stroke, palette-only).
- `logo/` — brand SVGs + programmatic `LOGO` / `logoSvgDocument()`.

All rules are enforced by `tests/` (`npm test` at the repo root).

## Legacy `--color-*` removal target: **before S4**

**Target:** the transitional legacy layer — the `legacyColors` / `tokens`
`color-*` keys in `src/tokens.ts` **and** the matching legacy `--color-*`
alias block at the end of `src/tokens.css` — must be **fully deleted before S4
starts**, i.e. immediately after the web and mobile migration steps (S2/S3)
land and no consumer reads a `color-*` name any more.

**Why it must go, rather than live on:**

1. **It exists only to keep the apps compiling during the migration.** The
   aliases were introduced so `apps/web` and `apps/mobile` keep building while
   they move from the old `color-*` names to the canonical keys
   (`--bg --surface --text …`). Their purpose ends when the migration ends;
   keeping them past that point keeps dead indirection forever.
2. **Two names for one value = two sources of truth.** Every canonical change
   would have to be mirrored in a legacy key as well, and the mirror is not
   what the apps were approved against — drift would go unnoticed until an app
   reads a stale alias.
3. **The legacy names encode collapsed semantics.** `color-text-secondary` and
   `color-text-tertiary` both resolve to `light.textMuted`, and
   `color-accent` is now navy (`light.primaryAction`). Code still using those
   names cannot express the distinction the canonical keys were built for, so
   every month they survive is a month new code writes the wrong concept.
4. **It doubles the surface the purity/parity tests must lock.** Palette
   purity, CSS parity and the exact `neutral.white` usage list all have to
   cover the alias block too; deleting it shrinks the tested surface to the
   canonical names only.

**Removal checklist (do at the S4 gate, in this package only):**

- delete `legacyColors` and the legacy half of `tokens` from `src/tokens.ts`
  (keep `structural`, `cssVar`, `cssTokenName`),
- delete the legacy `--color-*` block from `src/tokens.css`,
- drop the legacy assertions from `tests/tokens.test.ts`
  (parity/CSS-scan rows for `legacy.*`),
- keep `tokens` exported only if a non-color consumer still needs it —
  otherwise remove it from `src/index.ts`.
