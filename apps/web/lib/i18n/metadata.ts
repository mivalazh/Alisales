import type { Metadata } from 'next';
import { getLanguage } from './server';

type LocalizedPageMetadata = {
  title: string;
  description?: string;
};

/**
 * Page titles live outside the React tree, so the language cookie is read here
 * too. Without this, an English session still shows Persian browser-tab titles.
 */
export function localizedMetadata(
  fa: LocalizedPageMetadata,
  en: LocalizedPageMetadata,
) {
  return async function generateMetadata(): Promise<Metadata> {
    const lang = await getLanguage();
    return lang === 'en' ? en : fa;
  };
}

/**
 * Metadata for statically generated pages.
 *
 * Reading the language cookie in `generateMetadata` opts the whole route into
 * dynamic rendering, which defeats the edge cache, so cached catalogue pages
 * ship the Persian document (the site's default language) and keep their
 * English title/description in this one object for later use.
 */
export function staticMetadata(
  fa: LocalizedPageMetadata,
  _en: LocalizedPageMetadata,
  /**
   * Base path of the page. A statically generated catalogue renders the same
   * document for `?brand=`, `?q=`, `?sort=` and every other filter combination,
   * so those URLs must point search engines at the unfiltered page instead of
   * competing with it as duplicates.
   */
  canonical: string,
): Metadata {
  return {
    title: fa.title,
    ...(fa.description ? { description: fa.description } : {}),
    alternates: { canonical },
  };
}
