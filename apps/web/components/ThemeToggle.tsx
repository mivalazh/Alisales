'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icon';

/** localStorage key shared by the bootstrap script and the toggle. */
export const THEME_STORAGE_KEY = 'alisales-theme';

type Theme = 'light' | 'dark';

/**
 * Applies a theme to <html>. `data-theme` drives the token overrides in
 * globals.css; the `.dark` class is kept in sync for the class-based
 * convention, and `color-scheme` flips the native form controls and
 * scrollbars with the same switch.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // private mode — the session preference still applies
  }
}

/** Reads the theme the document is actually wearing. */
function readTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/**
 * Inline bootstrap applied by layout.tsx before paint (no FOUC). It honours a
 * saved choice first, then the OS preference, and always writes both the
 * attribute and the class so the first paint matches the toggle's state.
 */
export const themeBootstrapScript = `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');var d=document.documentElement;var dark=s==='dark'||(s!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);d.setAttribute('data-theme',dark?'dark':'light');d.classList.toggle('dark',dark);d.style.colorScheme=dark?'dark':'light';}catch(e){}})();`;

/**
 * Header control — flips light/dark instantly and persists the choice.
 *
 * The DOM is the source of truth: the click reads the live attribute instead of
 * trusting component state, so the button stays correct even after a reload,
 * a second tab, or a bootstrap that ran before hydration.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme(readTheme());
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY && (event.newValue === 'light' || event.newValue === 'dark')) {
        const next = event.newValue;
        document.documentElement.setAttribute('data-theme', next);
        document.documentElement.classList.toggle('dark', next === 'dark');
        document.documentElement.style.colorScheme = next;
        setTheme(next);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = () => {
    const next: Theme = readTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      data-theme-toggle={theme}
      aria-label={theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}
      aria-pressed={theme === 'dark'}
      title={theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-muted transition hover:border-line-strong hover:text-ink"
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} />
    </button>
  );
}
