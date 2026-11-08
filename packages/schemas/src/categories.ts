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
  motorcycle: 'موتور و اسکوتر برقی',
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
  /** Retired/petrol inventory brand: validates rows but is not offered in the new catalog. */
  legacy?: boolean;
}

// ── Motorcycles ─────────────────────────────────────────────────────────────

export const MOTORCYCLE_BRANDS: readonly CategoryBrand[] = [
  {
    slug: 'bike-super-soco',
    label: 'سوپر سوکو',
    latin: 'Super Soco',
    models: ['TC Max', 'TC', 'TSX', 'CPx', 'CUx'],
  },
  {
    slug: 'bike-niu',
    label: 'نیو',
    latin: 'NIU',
    models: ['NQi GT', 'NQi Sport', 'MQi+', 'UQi GT', 'KQi3'],
  },
  {
    slug: 'bike-segway',
    label: 'سگوی ناین‌بات',
    latin: 'Segway-Ninebot',
    models: ['E110S', 'E125S', 'B110S', 'KickScooter MAX G30', 'F40'],
  },
  {
    slug: 'bike-sur-ron',
    label: 'سور-ران',
    latin: 'Sur-Ron',
    models: ['Light Bee X', 'Storm Bee', 'Ultra Bee'],
  },
  {
    slug: 'bike-yadea',
    label: 'یادیا',
    latin: 'Yadea',
    models: ['G5', 'C-Umi', 'E8S', 'M6'],
  },
  {
    slug: 'bike-horwin',
    label: 'هوروین',
    latin: 'Horwin',
    models: ['CR6', 'EK3', 'EK1'],
  },
  {
    slug: 'bike-talaria',
    label: 'تالاریا',
    latin: 'Talaria',
    models: ['Sting R (MX4)', 'Sting (MX3)'],
  },
  {
    slug: 'bike-vespa',
    label: 'وسپا برقی',
    latin: 'Vespa Elettrica',
    models: ['Elettrica 45 km/h', 'Elettrica 70 km/h'],
  },
  {
    slug: 'bike-kavir',
    label: 'کویر موتور',
    latin: 'Kavir Motor',
    models: ['ES5', 'ES2', 'ET1', 'N2', 'Super Soco'],
  },
  {
    slug: 'bike-mado',
    label: 'مادو',
    latin: 'Mado',
    models: ['Mado 230', 'Mado 220'],
  },
  {
    slug: 'bike-honda',
    label: 'هوندا برقی',
    latin: 'Honda',
    models: ['U-GO', 'U-be', 'Zoomer-e', 'Dax-e'],
  },
  {
    slug: 'bike-yamaha',
    label: 'یاماها',
    latin: 'Yamaha',
    models: ['EMF', 'E-Vino', "NEO's"],
  },
  // Retired petrol inventory: rows still validate and their cards still print
  // the marque, but the new-catalog surfaces below hide these brands.
  {
    slug: 'bike-kawasaki',
    label: 'کاوازاکی',
    latin: 'Kawasaki',
    models: ['Ninja 400', 'Ninja ZX-6R', 'Z900', 'Versys 650', 'Vulcan S'],
    legacy: true,
  },
  {
    slug: 'bike-harley',
    label: 'هارلی دیویدسون',
    latin: 'Harley-Davidson',
    models: ['Sportster S', 'Fat Boy', 'Street Glide', 'Road King', 'Forty-Eight'],
    legacy: true,
  },
  {
    slug: 'bike-other',
    label: 'سایر برندهای موتور برقی',
    latin: 'Other',
    models: ['Dayang', 'Sunra', 'Evoke', 'Doohan iTango'],
  },
] as const;

// ── Heavy machinery ─────────────────────────────────────────────────────────

export const HEAVY_BRANDS: readonly CategoryBrand[] = [
  {
    slug: 'heavy-actros',
    label: 'مرسدس بنز',
    latin: 'Mercedes-Benz Trucks',
    models: ['Actros 1844', 'Actros 1848', 'Actros 3340', 'Axor', 'Atego'],
  },
  {
    slug: 'heavy-volvo',
    label: 'ولوو',
    latin: 'Volvo Trucks',
    models: ['FH460', 'FH500', 'FM', 'FMX'],
  },
  {
    slug: 'heavy-scania',
    label: 'اسکانیا',
    latin: 'Scania',
    models: ['R450', 'R500', 'G400', 'P-Series'],
  },
  {
    slug: 'heavy-man',
    label: 'مان',
    latin: 'MAN',
    models: ['TGX', 'TGS', 'TGM'],
  },
  {
    slug: 'heavy-isuzu',
    label: 'ایسوزو',
    latin: 'Isuzu',
    models: ['NPR 6T', 'NQR 8T', 'D-Max'],
  },
  {
    slug: 'heavy-fuso',
    label: 'میتسوبیشی فوسو',
    latin: 'Mitsubishi Fuso',
    models: ['Canter'],
  },
  {
    slug: 'heavy-hino',
    label: 'هینو',
    latin: 'Hino',
    models: ['300 Series', '500 Series'],
  },
  {
    slug: 'heavy-caterpillar',
    label: 'کاترپیلار',
    latin: 'Caterpillar',
    models: ['966', '950', '320', '330', 'D8'],
  },
  {
    slug: 'heavy-komatsu',
    label: 'کوماتسو',
    latin: 'Komatsu',
    models: ['WA470', 'WA380', 'PC200', 'PC220', 'D155'],
  },
  {
    slug: 'heavy-jcb',
    label: 'جی‌سی‌بی',
    latin: 'JCB',
    models: ['3CX', '4CX', 'Telehandler'],
  },
  {
    slug: 'heavy-bobcat',
    label: 'بابکت',
    latin: 'Bobcat',
    models: ['S130', 'S185', 'S250'],
  },
  {
    slug: 'heavy-tadano',
    label: 'تادانو و کاتو',
    latin: 'Tadano / Kato',
    models: ['Rough Terrain Crane', 'All Terrain Crane (25T)', 'All Terrain Crane (50T)'],
  },
  // Existing inventory rows keep resolving (Sinotruk is common in the Gulf).
  {
    slug: 'heavy-howo',
    legacy: true,
    label: 'سینوتراک / هاوو',
    latin: 'Sinotruk Howo',
    models: ['HOWO A7', 'HOWO 371 Dump', 'HOWO 380 Tractor', 'HOWO 340 Mixer'],
  },
  { slug: 'heavy-other', label: 'سایر', latin: 'Other', models: [] },
] as const;

// ── Type filters ────────────────────────────────────────────────────────────

export const BIKE_TYPES = [
  { key: 'scooter', label: 'اسکوتر برقی' },
  { key: 'electric', label: 'موتور برقی' },
  { key: 'petrol_scooter', label: 'اسکوتر بنزینی' },
  { key: 'sport', label: 'موتور اسپرت / ریس' },
  { key: 'cross', label: 'کراس و آفرود' },
  { key: 'classic', label: 'کلاسیک' },
  { key: 'touring', label: 'توریستی' },
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
