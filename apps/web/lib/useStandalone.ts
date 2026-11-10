'use client';

import { useEffect, useState } from 'react';

const STANDALONE_QUERIES = [
  '(display-mode: standalone)',
  '(display-mode: fullscreen)',
  '(display-mode: minimal-ui)',
] as const;

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  if (iosStandalone === true) return true;
  return STANDALONE_QUERIES.some((query) => window.matchMedia(query).matches);
}

/**
 * True when the page is running as an installed app (iOS home screen, Android
 * WebAPK or a desktop installed PWA) rather than in a browser tab. The initial
 * render is `false` so server HTML stays identical; installed mode is applied
 * after hydration, exactly like the theme bootstrap.
 */
export function useStandalone(): boolean {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const update = () => setStandalone(detectStandalone());
    update();

    const media = STANDALONE_QUERIES.map((query) => window.matchMedia(query));
    media.forEach((query) => query.addEventListener('change', update));
    window.addEventListener('appinstalled', update);
    return () => {
      media.forEach((query) => query.removeEventListener('change', update));
      window.removeEventListener('appinstalled', update);
    };
  }, []);

  return standalone;
}
