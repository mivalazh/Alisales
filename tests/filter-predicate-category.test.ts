import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS,
  JALALI_VEHICLE_YEARS,
  VEHICLE_YEARS,
  gregorianToJalaliYear,
  jalaliToGregorianYear,
  activeFilterCount,
  brandsForCategory,
  formatAedRateLine,
  irrToAED,
  irrToToman,
  tomanRateToIrr,
  tomanToIRR,
  aedToIRR,
  aedToToman,
  DEFAULT_AED_TO_IRR,
  isPlausibleAedRate,
} from '@alisales/schemas';
import { matchesFilters, type FilterableListing } from '../apps/web/lib/filter-match';

/**
 * The category-aware filter predicate and the single AED rate.
 *
 * These cover the refinement pass: motorcycles and heavy machinery carry spec
 * fields (cc, bike type, heavy type, working hours) that cars do not, and every
 * AED figure in the product now derives from one stored rate.
 */

const car: FilterableListing = {
  city: 'kish',
  brand: 'toyota',
  model: 'Land Cruiser VXR',
  trim: 'VXR',
  year: 2024,
  priceIRR: 34_000_000_000,
  mileageKm: 96_000,
  gearbox: 'automatic',
  fuel: 'petrol',
  plateType: 'kish',
  condition: 'used',
  hasReport: true,
  category: 'car',
};

const bike: FilterableListing = {
  ...car,
  brand: 'bike-yamaha',
  model: 'MT-07',
  trim: null,
  year: 2023,
  priceIRR: 4_200_000_000,
  mileageKm: 12_000,
  gearbox: 'manual',
  fuel: 'petrol',
  plateType: 'free',
  category: 'motorcycle',
  engineCc: 689,
  bikeType: 'sport',
};

const truck: FilterableListing = {
  ...car,
  brand: 'heavy-volvo',
  model: 'FH 460',
  trim: null,
  year: 2018,
  priceIRR: 92_000_000_000,
  mileageKm: 480_000,
  gearbox: 'manual',
  fuel: 'diesel',
  plateType: 'commercial',
  category: 'heavy',
  heavyType: 'truck',
  workingHours: 9_800,
};

describe('matchesFilters — category specs', () => {
  it('keeps a car when a bike engine filter is active', () => {
    expect(matchesFilters(car, { ...DEFAULT_FILTERS, engineCcMin: 600, engineCcMax: 900 })).toBe(
      true,
    );
  });

  it('filters motorcycles by engine displacement', () => {
    const cc = { ...DEFAULT_FILTERS, engineCcMin: 600, engineCcMax: 900 };
    expect(matchesFilters(bike, cc)).toBe(true);
    expect(matchesFilters(bike, { ...cc, engineCcMin: 1000 })).toBe(false);
  });

  it('filters motorcycles by type', () => {
    expect(matchesFilters(bike, { ...DEFAULT_FILTERS, bikeType: ['sport'] })).toBe(true);
    expect(matchesFilters(bike, { ...DEFAULT_FILTERS, bikeType: ['scooter'] })).toBe(false);
  });

  it('filters heavy machinery by type and working hours', () => {
    expect(matchesFilters(truck, { ...DEFAULT_FILTERS, heavyType: ['truck'] })).toBe(true);
    expect(matchesFilters(truck, { ...DEFAULT_FILTERS, heavyType: ['crane'] })).toBe(false);
    expect(matchesFilters(truck, { ...DEFAULT_FILTERS, workingHoursMax: 10_000 })).toBe(true);
    expect(matchesFilters(truck, { ...DEFAULT_FILTERS, workingHoursMax: 5_000 })).toBe(false);
  });

  it('filters by fuel', () => {
    expect(matchesFilters(truck, { ...DEFAULT_FILTERS, fuel: ['diesel'] })).toBe(true);
    expect(matchesFilters(truck, { ...DEFAULT_FILTERS, fuel: ['petrol'] })).toBe(false);
  });

  it('matches the Gregorian model-year range used on cards', () => {
    expect(matchesFilters(truck, { ...DEFAULT_FILTERS, yearFrom: 2018, yearTo: 2018 })).toBe(true);
    expect(matchesFilters(truck, { ...DEFAULT_FILTERS, yearFrom: 2019 })).toBe(false);
  });

  it('counts the new groups as active filters', () => {
    expect(activeFilterCount({ ...DEFAULT_FILTERS, fuel: ['diesel'] })).toBe(1);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, bikeType: ['sport'] })).toBe(1);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, heavyType: ['crane'] })).toBe(1);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, engineCcMin: 600 })).toBe(1);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, workingHoursMax: 5_000 })).toBe(1);
  });
});

describe('category brand catalogues', () => {
  it('uses prefixed slugs so bike and heavy marques never collide with cars', () => {
    const bikes = brandsForCategory('motorcycle').map((b) => b.slug);
    const heavy = brandsForCategory('heavy').map((b) => b.slug);
    const cars = brandsForCategory('car').map((b) => b.slug);
    expect(bikes).toContain('bike-yamaha');
    expect(heavy).toContain('heavy-volvo');
    expect(cars).toContain('toyota');
    expect(bikes.some((slug) => cars.includes(slug))).toBe(false);
    expect(bikes.some((slug) => heavy.includes(slug))).toBe(false);
  });

  it('offers only the import catalogue in the car brand box', () => {
    const cars = brandsForCategory('car').map((b) => b.slug);
    expect(cars).toContain('toyota');
    expect(cars).toContain('mercedes-benz');
    expect(cars).toContain('porsche');
    for (const domestic of ['ikco', 'saipa', 'mvm', 'parskhodro']) {
      expect(cars).not.toContain(domestic);
    }
  });

  it('offers an Other option as the last entry in every category', () => {
    expect(brandsForCategory('car').at(-1)?.label).toBe('سایر');
    expect(brandsForCategory('motorcycle').at(-1)?.label).toBe('سایر برندهای موتور برقی');
    expect(brandsForCategory('heavy').at(-1)?.label).toBe('سایر');
  });

  it('lists Gregorian model years newest first', () => {
    expect(VEHICLE_YEARS[0]).toBe(2026);
    expect(VEHICLE_YEARS).toContain(2022);
    expect(VEHICLE_YEARS).not.toContain(1444);
    expect(VEHICLE_YEARS).toEqual([...VEHICLE_YEARS].sort((a, b) => b - a));
  });

  it('shows the Jalali year beside the Gregorian one', () => {
    expect(gregorianToJalaliYear(2022)).toBe(1401);
    expect(jalaliToGregorianYear(1401)).toBe(2022);
    expect(JALALI_VEHICLE_YEARS[0]).toBe(1405);
  });
});

describe('AED rate conversion', () => {
  it('converts IRR to AED with the live rate', () => {
    expect(irrToAED(27_200_000, 272_000)).toBe(100);
    expect(irrToAED(27_200_000)).toBe(100);
    // A different stored rate must change the AED figure.
    expect(irrToAED(272_000_000, 340_000)).toBe(800);
  });

  it('divides rial by 10 for the Toman display', () => {
    expect(irrToToman(272_000_000)).toBe(27_200_000);
    expect(tomanToIRR(27_200_000)).toBe(272_000_000);
    expect(aedToToman(272_000)).toBe(27_200);
  });

  it('treats an admin value typed in Toman as rial per AED × 10', () => {
    expect(tomanRateToIrr(27_200)).toBe(272_000);
    expect(aedToIRR(1, tomanRateToIrr(27_200))).toBe(272_000);
  });

  it('rejects implausible stored rates', () => {
    expect(isPlausibleAedRate(DEFAULT_AED_TO_IRR)).toBe(true);
    expect(isPlausibleAedRate(10)).toBe(false);
    expect(isPlausibleAedRate(Number.NaN)).toBe(false);
    expect(isPlausibleAedRate('272000')).toBe(false);
  });

  it('prints the rate line with Persian digits and separators', () => {
    expect(formatAedRateLine({ aedToIrr: 272_000, updatedAt: '', source: 'default' })).toBe(
      '۱ درهم ≈ ۲۷٬۲۰۰ تومان',
    );
    expect(formatAedRateLine({ aedToIrr: 345_000, updatedAt: '', source: 'auto' })).toBe(
      '۱ درهم ≈ ۳۴٬۵۰۰ تومان',
    );
  });
});
