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
