'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

/** How price lines are rendered across the site. */
export type PriceUnit = 'both' | 'toman' | 'aed';

export const PRICE_UNIT_LABELS: Record<PriceUnit, string> = {
  toman: 'تومان',
  aed: 'درهم',
  both: 'هر دو',
};

const STORAGE_KEY = 'alisales-price-unit';

const PriceUnitContext = createContext<{
  unit: PriceUnit;
  setUnit: (next: PriceUnit) => void;
}>({ unit: 'both', setUnit: () => undefined });

/**
 * «واحد نمایش قیمت» — a viewer preference, stored on the device only.
 *
 * It changes display, never the stored value: prices are always IRR and the
 * seller's «فقط تومان» choice still wins over this setting.
 */
export function PriceUnitProvider({ children }: { children: ReactNode }) {
  const [unit, setUnitState] = useState<PriceUnit>('both');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'both' || stored === 'toman' || stored === 'aed') setUnitState(stored);
    } catch {
      // private mode — keep the default
    }
  }, []);

  const setUnit = useCallback((next: PriceUnit) => {
    setUnitState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // private mode — session only
    }
  }, []);

  return (
    <PriceUnitContext.Provider value={{ unit, setUnit }}>{children}</PriceUnitContext.Provider>
  );
}

export function usePriceUnit() {
  return useContext(PriceUnitContext);
}
