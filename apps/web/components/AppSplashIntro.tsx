'use client';

import { useEffect, useState } from 'react';
import { BrandLockup } from './BrandLockup';

const SPLASH_KEY = 'alisales-splash-seen';

/**
 * A single, fast launch beat on the first page of a session.
 *
 * The overlay is server-rendered so it covers the first paint (no white flash).
 * A tiny head script marks repeat visits before paint, and this component fades
 * the first visit out after 950 ms.
 */
export function AppSplashIntro() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SPLASH_KEY)) {
        setVisible(false);
        return;
      }
      sessionStorage.setItem(SPLASH_KEY, '1');
    } catch {
      // Private mode: still show the launch beat for this page.
    }

    const fade = window.setTimeout(() => setLeaving(true), 760);
    const remove = window.setTimeout(() => setVisible(false), 950);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(remove);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`app-splash ${leaving ? 'is-leaving' : ''}`}
      role="status"
      aria-label="Ali Sales"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="app-splash-mark">
          <BrandLockup size="lg" wordmark={false} />
        </div>
        <div className="flex items-baseline gap-1.5 text-xl font-black tracking-[0.16em]">
          <span className="app-splash-word" style={{ color: 'var(--logo-navy)' }}>
            ALI
          </span>
          <span
            className="app-splash-word"
            style={{ color: 'var(--logo-sales)' }}
          >
            SALES
          </span>
        </div>
      </div>
    </div>
  );
}
