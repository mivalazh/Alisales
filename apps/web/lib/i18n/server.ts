import { cookies } from 'next/headers';
import type { Language } from '@/lib/i18n';
import { translate } from './dictionary';

/** The language persisted by `LocaleProvider`, readable from server pages. */
export async function getLanguage(): Promise<Language> {
  const stored = (await cookies()).get('alisales-language')?.value;
  return stored === 'en' ? 'en' : 'fa';
}

/** Server-side translation for copy rendered outside the client provider. */
export function serverT(lang: Language, fa: string, en?: string): string {
  return lang === 'en' ? translate(fa, en) : fa;
}
