'use client';

import { useEffect, useState } from 'react';

/**
 * Delayed busy visibility (Doherty threshold).
 *
 * The work itself starts immediately; only the spinner waits. A fast fetch or
 * transition therefore completes without a loader flashing, while genuinely
 * slow work gets a progress indicator after 250ms.
 */
export function useDelayedBusy(active: boolean, delay = 250): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [active, delay]);

  return visible;
}
