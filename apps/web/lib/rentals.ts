import { RENTAL_SEEDS } from './data/rentals';
import { listRentalPosts, type RentalPosting } from './data/platform-store';

/** Seeded fleet + agency postings, newest first. */
export function allRentals(): RentalPosting[] {
  return [...listRentalPosts(), ...RENTAL_SEEDS];
}

export function rentalBySlug(slug: string): RentalPosting | null {
  return allRentals().find((rental) => rental.slug === slug) ?? null;
}

/** Toman label for a stored IRR rate («۹٫۰۰۰٫۰۰۰ تومان»). */
export function tomanLabel(irr: number): string {
  return `${Math.round(irr / 10).toLocaleString('en-US')} تومان`;
}
