import { z } from 'zod';

/**
 * Subscription plans.
 *
 * ⚠ PRICING GATE (legal/finance sign-off required to change):
 *  - individuals: free, 2 concurrent listings
 *  - basic: 8,000,000 IRR/mo → 10 listings, 1 featured, 1 inspection, priority 1
 *  - pro:   20,000,000 IRR/mo → 40 listings, 5 featured, 3 inspections, priority 2
 * tests/subscription.test.ts locks these numbers.
 */
export const FREE_LISTING_LIMIT = 2;
export const PLAN_CODES = ['free', 'basic', 'pro'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const planSchema = z.object({
  code: z.enum(PLAN_CODES),
  name: z.string().min(1),
  priceIRR: z.number().int().min(0),
  listingLimit: z.number().int().min(1),
  featuredSlots: z.number().int().min(0),
  freeInspectionsPerMonth: z.number().int().min(0),
  searchPriority: z.number().int().min(0),
  isActive: z.boolean().default(true),
});
export type Plan = z.infer<typeof planSchema>;

export const DEFAULT_PLANS: Record<PlanCode, Plan> = {
  free: {
    code: 'free',
    name: 'رایگان (اشخاص)',
    priceIRR: 0,
    listingLimit: FREE_LISTING_LIMIT,
    featuredSlots: 0,
    freeInspectionsPerMonth: 0,
    searchPriority: 0,
    isActive: true,
  },
  basic: {
    code: 'basic',
    name: 'پایه',
    priceIRR: 8_000_000,
    listingLimit: 10,
    featuredSlots: 1,
    freeInspectionsPerMonth: 1,
    searchPriority: 1,
    isActive: true,
  },
  pro: {
    code: 'pro',
    name: 'حرفه‌ای',
    priceIRR: 20_000_000,
    listingLimit: 40,
    featuredSlots: 5,
    freeInspectionsPerMonth: 3,
    searchPriority: 2,
    isActive: true,
  },
};

export function planFor(code: PlanCode): Plan {
  return DEFAULT_PLANS[code];
}

/** Slots already consumed for an owner (individual or showroom). */
export function remainingSlots(plan: Pick<Plan, 'listingLimit'>, usedSlots: number): number {
  return Math.max(0, plan.listingLimit - usedSlots);
}

export interface CreateListingCheck {
  plan: Pick<Plan, 'listingLimit'>;
  usedSlots: number;
}

/** Enforced in UI, Zod guards and the `enforce_listing_guard` DB trigger. */
export function canCreateListing(check: CreateListingCheck): boolean {
  return check.usedSlots < check.plan.listingLimit;
}
