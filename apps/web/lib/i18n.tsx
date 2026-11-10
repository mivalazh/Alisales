'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { translate } from './i18n/dictionary';

export type Language = 'fa' | 'en';

interface LocaleValue {
  lang: Language;
  dir: 'rtl' | 'ltr';
  /** Translate inline; the centralized dictionary is the fallback. */
  t: (fa: string, en?: string) => string;
  setLanguage: (next: Language) => void;
  toggleLanguage: () => void;
}

const LocaleContext = createContext<LocaleValue | null>(null);
const STORAGE_KEY = 'alisales-language';

/**
 * Lightweight site language layer.
 *
 * The marketplace is Persian-first, so `fa` is the server-rendered default and
 * the stored preference is applied after hydration. Only the chrome — nav,
 * drawer, footer, filter labels and the control bar — is translated; listing
 * copy written by sellers is never machine-translated.
 */
export function LocaleProvider({
  children,
  initialLang = 'fa',
}: {
  children: ReactNode;
  initialLang?: Language;
}) {
  const [lang, setLangState] = useState<Language>(initialLang);
  const router = useRouter();

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'fa' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.cookie = `${STORAGE_KEY}=${lang};path=/;max-age=31536000;samesite=lax`;
    } catch {
      // private mode
    }
  }, [lang]);

  const setLanguage = useCallback(
    (next: Language) => {
      setLangState(next);
      try {
        document.cookie = `${STORAGE_KEY}=${next};path=/;max-age=31536000;samesite=lax`;
      } catch {
        // private mode — the client provider still switches
      }
      // Re-render server pages so `<html dir/lang>` and server copy follow.
      router.refresh();
    },
    [router],
  );
  const toggleLanguage = useCallback(
    () => setLanguage(lang === 'fa' ? 'en' : 'fa'),
    [lang, setLanguage],
  );

  const value = useMemo<LocaleValue>(
    () => ({
      lang,
      dir: lang === 'fa' ? 'rtl' : 'ltr',
      t: (fa, en) => (lang === 'en' ? translate(fa, en) : fa),
      setLanguage,
      toggleLanguage,
    }),
    [lang, setLanguage, toggleLanguage],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): LocaleValue {
  const context = useContext(LocaleContext);
  // Server components and isolated widgets may render outside the provider;
  // Persian is a safe fallback rather than a crash.
  return (
    context ?? {
      lang: 'fa',
      dir: 'rtl',
      t: (fa) => fa,
      setLanguage: () => undefined,
      toggleLanguage: () => undefined,
    }
  );
}
