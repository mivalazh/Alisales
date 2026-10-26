'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icon';

const STORAGE_KEY = 'alisales-theme';

type Theme = 'light' | 'dark';

/** Inline bootstrap applied by layout.tsx before paint (no FOUC). */
export const themeBootstrapScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

/** Header control — flips light/dark and persists the choice. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'dark' : 'light');
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // private mode — the session preference still applies
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}
      title={theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-muted transition hover:border-line-strong hover:text-ink"
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} />
    </button>
  );
}
