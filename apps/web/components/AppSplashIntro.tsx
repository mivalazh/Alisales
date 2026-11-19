'use client';

import { useEffect, useState } from 'react';
import { BrandLockup } from './BrandLockup';

const SPLASH_KEY = 'alisales-splash-seen';

/**
 * One crisp brand beat per session.
 *
 * The very first frame of a launch is the two-tone emblem + ALI SALES on the
 * page's own cream surface, so a cold start never shows a blank white screen.
 * The beat is short and total: the layer is painted by the server render, the
 * mark scales/fades in, and the whole overlay fades out over the already
 * painted page after ~0.4s; it is gone by 550ms. Later page loads in the same
 * session skip it entirely (the pre-paint script in the layout sets
 * `data-splash-seen`, so there is not even a flash).
 *
 * It never intercepts touches and never locks scrolling.
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
      // Private mode: still show the short beat for this page.
    }

    const fade = window.setTimeout(() => setLeaving(true), 380);
    const remove = window.setTimeout(() => setVisible(false), 550);
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
      <div className="app-splash-mark" dir="ltr">
        <BrandLockup size="lg" />
      </div>
    </div>
  );
}
