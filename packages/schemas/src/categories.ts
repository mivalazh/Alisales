/**
 * Vehicle categories — the top-level switch (خودرو | موتورسیکلت | ماشین‌آلات
 * سنگین) plus parts.
 *
 * Each category owns its own brand catalogue, its own form fields and its own
 * filters, but they all store into the one `vehicles` row shape: `category`
 * says which brand list the row belongs to, and the category-specific extras
 * (`engineCc`, `bikeType`, `heavyType`, `workingHours`) are optional columns on
 * the same row.
 *
 * Bike and heavy brand slugs are prefixed (`bike-*`, `heavy-*`) so the single
 * flat brand enum can never collide with a car marque that shares a name (Honda
 * sells both cars and motorcycles; Volvo and Mitsubishi sell both cars and
 * trucks).
 */

export const vehicleCategories = ['car', 'motorcycle', 'heavy'] as const;
export type VehicleCategory = (typeof vehicleCategories)[number];

/** Everything a seller can publish: the three vehicle categories plus parts. */
export const listingCategories = ['car', 'motorcycle', 'heavy', 'part'] as const;
export type ListingCategory = (typeof listingCategories)[number];

export const VEHICLE_CATEGORY_LABELS: Record<VehicleCategory, string> = {
  car: 'خودرو',
  motorcycle: 'موتورسیکلت',
  heavy: 'ماشین‌آلات سنگین',
};

export const LISTING_CATEGORY_LABELS: Record<ListingCategory, string> = {
  ...VEHICLE_CATEGORY_LABELS,
  part: 'قطعات',
};

export interface CategoryBrand {
  slug: string;
  label: string;
  /** Latin marque name — printed above the model on cards, always LTR. */
  latin: string;
  models: readonly string[];
}

// ── Motorcycles ─────────────────────────────────────────────────────────────

export const MOTORCYCLE_BRANDS: readonly CategoryBrand[] = [
  {
    slug: 'bike-yamaha',
    label: 'یاماها',
    latin: 'Yamaha',
    models: ['MT-07', 'MT-09', 'R1', 'R6', 'TMAX', 'XSR900', 'Tenere 700'],
  },
  {
    slug: 'bike-honda',
    label: 'هوندا',
    latin: 'Honda',
    models: ['CBR500R', 'CBR1000RR', 'CB650R', 'NC750X', 'PCX', 'Forza 350', 'Rebel 500'],
  },
  {
    slug: 'bike-suzuki',
    label: 'سوزوکی',
    latin: 'Suzuki',
    models: ['GSX-R1000', 'GSX-8S', 'V-Strom 650', 'Burgman 400', 'SV650'],
  },
  {
    slug: 'bike-kawasaki',
    label: 'کاوازاکی',
    latin: 'Kawasaki',
    models: ['Ninja 400', 'Ninja ZX-6R', 'Z900', 'Versys 650', 'Vulcan S'],
  },
  {
    slug: 'bike-ktm',
    label: 'کی‌تی‌ام',
    latin: 'KTM',
    models: ['Duke 390', 'Duke 790', 'RC 390', 'Adventure 890', 'EXC 300'],
  },
  {
    slug: 'bike-ducati',
    label: 'دوکاتی',
    latin: 'Ducati',
    models: ['Monster', 'Panigale V4', 'Multistrada V4', 'Scrambler', 'Diavel'],
  },
  {
    slug: 'bike-benelli',
    label: 'بنلی',
    latin: 'Benelli',
    models: ['TNT 250', 'TRK 502', 'Leoncino 500', '302R', 'Imperiale 400'],
  },
  {
    slug: 'bike-bajaj',
    label: 'باجاج',
    latin: 'Bajaj',
    models: ['Pulsar 200NS', 'Pulsar 220', 'Dominar 400', 'Boxer 150', 'Avenger 220'],
  },
  {
    slug: 'bike-harley',
    label: 'هارلی دیویدسون',
    latin: 'Harley-Davidson',
    models: ['Sportster S', 'Fat Boy', 'Street Glide', 'Road King', 'Forty-Eight'],
  },
  { slug: 'bike-other', label: 'سایر', latin: 'Other', models: [] },
] as const;

// ── Heavy machinery ─────────────────────────────────────────────────────────

export const HEAVY_BRANDS: readonly CategoryBrand[] = [
  {
    slug: 'heavy-volvo',
    label: 'ولوو',
    latin: 'Volvo',
    models: ['FH16', 'FH 500', 'FM 460', 'FMX 440', 'EC480 Excavator'],
  },
  {
    slug: 'heavy-scania',
    label: 'اسکانیا',
    latin: 'Scania',
    models: ['R500', 'R450', 'S730', 'G410', 'P360'],
  },
  {
    slug: 'heavy-man',
    label: 'مان',
    latin: 'MAN',
    models: ['TGX 18.480', 'TGS 33.400', 'TGM 18.240', 'TGA 26.440'],
  },
  {
    slug: 'heavy-actros',
    label: 'مرسدس آکتروس',
    latin: 'Mercedes-Benz Actros',
    models: ['Actros 1845', 'Actros 2645', 'Axor 1840', 'Atego 1524'],
  },
  {
    slug: 'heavy-howo',
    label: 'سینوتراک / هاوو',
    latin: 'Sinotruk Howo',
    models: ['HOWO A7', 'HOWO 371 Dump', 'HOWO 380 Tractor', 'HOWO 340 Mixer'],
  },
  {
    slug: 'heavy-isuzu',
    label: 'ایسوزو',
    latin: 'Isuzu',
    models: ['NPR 75', 'FVR 900', 'GIGA 6x4', 'FRR 90'],
  },
  {
    slug: 'heavy-hino',
    label: 'هینو',
    latin: 'Hino',
    models: ['500 Series', '700 Series', '300 Series', 'Hino Ranger'],
  },
  { slug: 'heavy-kamaz', label: 'کاماز', latin: 'Kamaz', models: ['6520', '5490', '43118', '43253'] },
  { slug: 'heavy-foton', label: 'فوتون', latin: 'Foton', models: ['Auman ETX', 'Aumark S', 'Tunland'] },
  {
    slug: 'heavy-fuso',
    label: 'میتسوبیشی فوسو',
    latin: 'Mitsubishi Fuso',
    models: ['Fuso Fighter', 'Canter', 'Super Great'],
  },
  {
    slug: 'heavy-caterpillar',
    label: 'کاترپیلار',
    latin: 'Caterpillar',
    models: ['320D Excavator', '336 Excavator', '950GC Loader', 'D6 Dozer', '140K Grader'],
  },
  {
    slug: 'heavy-komatsu',
    label: 'کوماتسو',
    latin: 'Komatsu',
    models: ['PC200-8', 'PC300-7', 'WA380 Loader', 'D65 Dozer', 'GD655 Grader'],
  },
  { slug: 'heavy-other', label: 'سایر', latin: 'Other', models: [] },
] as const;

// ── Type filters ────────────────────────────────────────────────────────────

export const BIKE_TYPES = [
  { key: 'classic', label: 'کلاسیک' },
  { key: 'sport', label: 'اسپرت' },
  { key: 'scooter', label: 'اسکوتر' },
  { key: 'cross', label: 'کراس' },
  { key: 'touring', label: 'توریستی' },
  { key: 'offroad', label: 'آفرود' },
] as const;
export type BikeType = (typeof BIKE_TYPES)[number]['key'];
export const bikeTypeKeys = BIKE_TYPES.map((t) => t.key) as [BikeType, ...BikeType[]];

export const HEAVY_TYPES = [
  { key: 'truck', label: 'کامیون' },
  { key: 'tractor', label: 'کشنده' },
  { key: 'trailer', label: 'تریلی' },
  { key: 'excavator', label: 'بیل مکانیکی' },
  { key: 'loader', label: 'لودر' },
  { key: 'crane', label: 'جرثقیل' },
  { key: 'dozer', label: 'بلدوزر' },
  { key: 'mixer', label: 'میکسر' },
  { key: 'other', label: 'سایر' },
] as const;
export type HeavyType = (typeof HEAVY_TYPES)[number]['key'];
export const heavyTypeKeys = HEAVY_TYPES.map((t) => t.key) as [HeavyType, ...HeavyType[]];

export const BIKE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  BIKE_TYPES.map((t) => [t.key, t.label]),
);
export const HEAVY_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  HEAVY_TYPES.map((t) => [t.key, t.label]),
);

/** Card line for a motorcycle: «600 cc · اسپرت». */
export function motorcycleSpec(engineCc: number | null | undefined, bikeType: string | null | undefined): string | null {
  const parts: string[] = [];
  if (engineCc) parts.push(`${new Intl.NumberFormat('en-US').format(engineCc)} cc`);
  if (bikeType && BIKE_TYPE_LABELS[bikeType]) parts.push(BIKE_TYPE_LABELS[bikeType]!);
  return parts.length ? parts.join(' · ') : null;
}

/** Card line for heavy machinery: «کشنده · ۱۲٬۵۰۰ ساعت کارکرد». */
export function heavySpec(
  heavyType: string | null | undefined,
  workingHours: number | null | undefined,
): string | null {
  const parts: string[] = [];
  if (heavyType && HEAVY_TYPE_LABELS[heavyType]) parts.push(HEAVY_TYPE_LABELS[heavyType]!);
  if (workingHours) parts.push(`${new Intl.NumberFormat('en-US').format(workingHours)} hours`);
  return parts.length ? parts.join(' · ') : null;
}
