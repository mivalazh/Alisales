'use client';

import { useEffect, useState } from 'react';
import { BrandLockup } from './BrandLockup';

const SPLASH_KEY = 'alisales-splash-seen';

const ALI = ['A', 'L', 'I'] as const;
const SALES = ['S', 'A', 'L', 'E', 'S'] as const;

/**
 * A single, fast launch beat on the first page of a session.
 *
 * The overlay is server-rendered so it covers the first paint (no white flash).
 * A tiny head script marks repeat visits before paint, and this component fades
 * the first visit out after the 750 ms motion sequence.
 *
 * The wordmark is deliberately `dir="ltr"`: the page is RTL, but the brand
 * must always read ALI then SALES from left to right.
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

    const fade = window.setTimeout(() => setLeaving(true), 620);
    const remove = window.setTimeout(() => setVisible(false), 750);
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
      <div className="app-splash-stage" dir="ltr">
        <div className="app-splash-mark">
          <BrandLockup size="lg" wordmark={false} animated />
        </div>

        <div className="app-splash-wordmark" dir="ltr" aria-label="ALI SALES">
          <span className="app-splash-word app-splash-word-ali">
            {ALI.map((letter, index) => (
              <span
                key={`${letter}-${index}`}
                className="app-splash-letter"
                style={{ animationDelay: `${120 + index * 28}ms` }}
              >
                {letter}
              </span>
            ))}
          </span>
          <span className="app-splash-word app-splash-word-sales">
            {SALES.map((letter, index) => (
              <span
                key={`${letter}-${index}`}
                className="app-splash-letter"
                style={{ animationDelay: `${204 + index * 28}ms` }}
              >
                {letter}
              </span>
            ))}
          </span>
          <span className="app-splash-underline" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
