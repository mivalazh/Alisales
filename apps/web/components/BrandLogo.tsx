'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * One brand mark in the brand grid.
 *
 * The artwork is read from `/assets/brands/{brand-slug}.svg` (for example
 * `/assets/brands/toyota.svg`, `/assets/brands/heavy-volvo.svg`). Files are
 * added by hand, so every mark is contained in the same 48px-tall slot and
 * keeps its own colours and proportions: no borders, no monochrome filter and
 * no dark-mode inversion.
 *
 * A slug with no artwork yet falls back to a neutral placeholder — the brand's
 * Latin name as quiet text straight on the page surface, with no tile fill or
 * border — so the grid stays light and every brand remains selectable while
 * the files are being collected.
 */
export function BrandLogo({ slug, name }: { slug: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const image = useRef<HTMLImageElement>(null);

  // A 404 can land before React hydrates, in which case the onError handler is
  // never called and the browser keeps showing a broken-image glyph. Inspect
  // the element after mount as well, so a missing file always resolves to the
  // neutral placeholder.
  useEffect(() => {
    const node = image.current;
    if (node?.complete && node.naturalWidth === 0) setFailed(true);
  }, [slug]);

  if (failed) {
    return (
      <span
        aria-hidden="true"
        className="flex h-12 w-full items-center justify-center px-1 text-center text-[9px] font-extrabold uppercase leading-tight tracking-[0.06em] text-faint"
      >
        <span className="line-clamp-2" dir="ltr">
          {name}
        </span>
      </span>
    );
  }

  return (
    <span className="flex h-12 w-full items-center justify-center">
      {/* The bundled marks are single-colour paths with no fill of their own, so
          they inherit the document's black. In dark mode a black mark on the
          navy surface would be invisible, hence the invert; the shapes stay
          exact and light mode keeps the marks at their original ink. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={image}
        src={`/assets/brands/${slug}.svg`}
        alt={name}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-12 w-auto max-w-full object-contain dark:invert"
      />
    </span>
  );
}
