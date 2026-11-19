'use client';

import { useEffect, useState } from 'react';
import { BrandLockup } from './BrandLockup';

const SPLASH_KEY = 'alisales-splash-seen';

/**
 * One minimal launch beat per session.
 *
 * The page shell is never hidden: this layer is a small, transparent,
 * `pointer-events-none` brand mark that fades out in ~0.4s over content that is
 * already painted underneath. No opaque surface, no staged letter animation,
 * no full-screen flash — just a quiet acknowledgement while the first cards
 * render.
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

    const fade = window.setTimeout(() => setLeaving(true), 240);
    const remove = window.setTimeout(() => setVisible(false), 400);
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
        <BrandLockup size="sm" />
      </div>
    </div>
  );
}
