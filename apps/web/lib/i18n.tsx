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

export type Language = 'fa' | 'en';

interface LocaleValue {
  lang: Language;
  dir: 'rtl' | 'ltr';
  /** Translate inline: `t('خانه', 'Home')`. */
  t: (fa: string, en: string) => string;
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
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('fa');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'en' || stored === 'fa') setLangState(stored);
    } catch {
      // private mode — Persian stays
    }
  }, []);

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

  const setLanguage = useCallback((next: Language) => setLangState(next), []);
  const toggleLanguage = useCallback(
    () => setLangState((current) => (current === 'fa' ? 'en' : 'fa')),
    [],
  );

  const value = useMemo<LocaleValue>(
    () => ({
      lang,
      dir: lang === 'fa' ? 'rtl' : 'ltr',
      t: (fa, en) => (lang === 'en' ? en : fa),
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
