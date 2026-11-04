'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { AedRate } from '@alisales/schemas';

/**
 * The AED reference rate for client components.
 *
 * The server layout reads the one stored rate and hands it down, so the price
 * component, the publish form and the «نرخ روز» line all convert with the same
 * number — no screen carries its own constant.
 */
const RateContext = createContext<AedRate | null>(null);

export function RateProvider({ rate, children }: { rate: AedRate; children: ReactNode }) {
  return <RateContext.Provider value={rate}>{children}</RateContext.Provider>;
}

/** Null outside the provider (tests, isolated stories) → default rate. */
export function useAedRate(): AedRate | null {
  return useContext(RateContext);
}
