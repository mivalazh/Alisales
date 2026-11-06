import { z } from 'zod';
import {
  bodyTypes,
  colorSlugs,
  conditions,
  fuelTypes,
  gearboxTypes,
  type BodyType,
} from './enums';
import {
  HEAVY_BRANDS,
  MOTORCYCLE_BRANDS,
  vehicleCategories,
  type CategoryBrand,
} from './categories';

/**
 * Market brands — the Kish free-zone import catalogue.
 *
 * The marketplace sells imported and luxury cars, so the domestic Iranian
 * marques (IKCO, Saipa, Pars Khodro, MVM …) and the Iran-assembled French
 * models are deliberately absent: a brand box full of Pride and Peugeot 206
 * tiles made the catalogue look like a domestic classifieds site.
 *
 * Every brand shows a Latin marque name (`latin`) as well as its Persian label:
 * the card prints the Latin name above the model, always `dir="ltr"`, so a
 * mixed RTL/LTR title never reorders. `models` are Latin too and stay a
 * suggestion list — model (and a custom brand) remain free text.
 */
export const BRANDS = [
  {
    slug: 'toyota',
    label: 'تویوتا',
    latin: 'Toyota',
    models: [
      'Land Cruiser',
      'Land Cruiser Prado',
      'Land Cruiser VXR',
      'Prado',
      'Hilux',
      'Fortuner',
      'Camry',
      'Corolla',
      'RAV4',
      'C-HR',
      'Supra',
      'Sequoia',
    ],
  },
  {
    slug: 'nissan',
    label: 'نیسان',
    latin: 'Nissan',
    models: ['Patrol', 'Patrol Platinum', 'X-Trail', 'Qashqai', 'Altima', 'Maxima', 'Juke', '370Z', 'GT-R'],
  },
  {
    slug: 'honda',
    label: 'هوندا',
    latin: 'Honda',
    models: ['Accord', 'Civic', 'CR-V', 'Pilot', 'HR-V', 'Odyssey'],
  },
  {
    slug: 'mazda',
    label: 'مزدا',
    latin: 'Mazda',
    models: ['Mazda 3', 'Mazda 6', 'CX-5', 'CX-9', 'MX-5'],
  },
  {
    slug: 'mitsubishi',
    label: 'میتسوبیشی',
    latin: 'Mitsubishi',
    models: ['Pajero', 'Pajero Sport', 'L200', 'Outlander', 'Eclipse Cross', 'ASX'],
  },
  {
    slug: 'subaru',
    label: 'سوبارو',
    latin: 'Subaru',
    models: ['Forester', 'Outback', 'Impreza', 'XV', 'WRX'],
  },
  {
    slug: 'lexus',
    label: 'لکسوس',
    latin: 'Lexus',
    models: ['LX 570', 'LX 600', 'RX', 'ES', 'NX', 'GX', 'IS', 'LS'],
  },
  {
    slug: 'infiniti',
    label: 'اینفینیتی',
    latin: 'Infiniti',
    models: ['Q50', 'Q60', 'QX50', 'QX60', 'QX80'],
  },
  {
    slug: 'mercedes-benz',
    label: 'مرسدس‌بنز',
    latin: 'Mercedes-Benz',
    models: [
      'S-Class',
      'E-Class',
      'C-Class',
      'G-Class',
      'GLE',
      'GLS',
      'GLC',
      'S 500',
      'S 580',
      'AMG GT',
      'V-Class',
    ],
  },
  {
    slug: 'bmw',
    label: 'بی‌ام‌و',
    latin: 'BMW',
    models: [
      '3 Series',
      '5 Series',
      '7 Series',
      'X1',
      'X3',
      'X5',
      'X6',
      'X7',
      'M3',
      'M5',
      'iX',
    ],
  },
  {
    slug: 'audi',
    label: 'آئودی',
    latin: 'Audi',
    models: ['A4', 'A6', 'A8', 'Q5', 'Q7', 'Q8', 'RS7', 'e-tron'],
  },
  {
    slug: 'porsche',
    label: 'پورشه',
    latin: 'Porsche',
    models: ['Cayenne', 'Macan', 'Panamera', '911', 'Boxster', 'Taycan'],
  },
  {
    slug: 'volkswagen',
    label: 'فولکس‌واگن',
    latin: 'Volkswagen',
    models: ['Golf', 'Tiguan', 'Passat', 'Touareg', 'Arteon', 'ID.4'],
  },
  {
    slug: 'mini',
    label: 'مینی',
    latin: 'MINI',
    models: ['Cooper', 'Countryman', 'Clubman', 'John Cooper Works'],
  },
  {
    slug: 'volvo',
    label: 'ولوو',
    latin: 'Volvo',
    models: ['XC40', 'XC60', 'XC90', 'S60', 'S90'],
  },
  {
    slug: 'jaguar',
    label: 'جگوار',
    latin: 'Jaguar',
    models: ['XE', 'XF', 'F-Pace', 'E-Pace', 'F-Type'],
  },
  {
    slug: 'land-rover',
    label: 'لندروور',
    latin: 'Land Rover',
    models: ['Range Rover', 'Range Rover Sport', 'Range Rover Velar', 'Defender', 'Discovery', 'Evoque'],
  },
  {
    slug: 'range-rover',
    label: 'رنج‌روور',
    latin: 'Range Rover',
    models: ['Vogue', 'Sport', 'Velar', 'Evoque', 'Autobiography'],
  },
  {
    slug: 'maserati',
    label: 'مازراتی',
    latin: 'Maserati',
    models: ['Ghibli', 'Levante', 'Quattroporte', 'GranTurismo', 'MC20'],
  },
  {
    slug: 'cadillac',
    label: 'کادیلاک',
    latin: 'Cadillac',
    models: ['Escalade', 'CT4', 'CT5', 'XT5', 'XT6'],
  },
  {
    slug: 'ford',
    label: 'فورد',
    latin: 'Ford',
    models: ['Mustang', 'Explorer', 'F-150', 'Edge', 'Expedition', 'Bronco'],
  },
  {
    slug: 'chevrolet',
    label: 'شورولت',
    latin: 'Chevrolet',
    models: ['Camaro', 'Corvette', 'Tahoe', 'Silverado', 'Malibu', 'Traverse'],
  },
  {
    slug: 'dodge',
    label: 'دوج',
    latin: 'Dodge',
    models: ['Challenger', 'Charger', 'Durango', 'Ram 1500'],
  },
  {
    slug: 'jeep',
    label: 'جیپ',
    latin: 'Jeep',
    models: ['Wrangler', 'Grand Cherokee', 'Compass', 'Cherokee', 'Gladiator'],
  },
  {
    slug: 'tesla',
    label: 'تسلا',
    latin: 'Tesla',
    models: ['Model 3', 'Model Y', 'Model S', 'Model X'],
  },
  {
    slug: 'hyundai',
    label: 'هیوندای',
    latin: 'Hyundai',
    models: ['Accent', 'Elantra', 'Sonata', 'Tucson', 'Santa Fe', 'Palisade', 'Kona'],
  },
  {
    slug: 'kia',
    label: 'کیا',
    latin: 'Kia',
    models: ['Cerato', 'Optima', 'K5', 'Sportage', 'Sorento', 'Telluride', 'Picanto', 'Stinger'],
  },
  {
    slug: 'genesis',
    label: 'جنسیس',
    latin: 'Genesis',
    models: ['G70', 'G80', 'G90', 'GV70', 'GV80'],
  },
  { slug: 'mg', label: 'ام‌جی', latin: 'MG', models: ['MG5', 'MG6', 'ZS', 'HS', 'RX5'] },
  { slug: 'chery', label: 'چری', latin: 'Chery', models: ['Arrizo 6', 'Arrizo 8', 'Tiggo 7 Pro', 'Tiggo 8 Pro'] },
  { slug: 'geely', label: 'جیلی', latin: 'Geely', models: ['Emgrand 7', 'Coolray', 'Tugella', 'Okavango', 'Atlas'] },
  { slug: 'byd', label: 'بی‌وای‌دی', latin: 'BYD', models: ['Song Plus', 'Seal', 'Atto 3', 'Han', 'Tang'] },
  { slug: 'haval', label: 'هاول', latin: 'Haval', models: ['H6', 'H9', 'Jolion', 'Dargo', 'H6 GT'] },
  { slug: 'jac', label: 'جک', latin: 'JAC', models: ['S3', 'S5', 'J4', 'T8', 'Sehol X4'] },
  { slug: 'changan', label: 'چانگان', latin: 'Changan', models: ['CS35', 'CS55', 'CS75', 'Eado', 'UNI-T'] },
  { slug: 'lifan', label: 'لیفان', latin: 'Lifan', models: ['X50', 'X60', 'X70', '820', '620'] },
  { slug: 'fiat', label: 'فیات', latin: 'Fiat', models: ['500', 'Tipo', 'Panda', 'Doblo'] },
  { slug: 'opel', label: 'اپل', latin: 'Opel', models: ['Astra', 'Corsa', 'Insignia', 'Mokka', 'Grandland'] },
  {
    slug: 'lamborghini',
    label: 'لامبورگینی',
    latin: 'Lamborghini',
    models: ['Huracán', 'Huracán EVO', 'Aventador', 'Urus', 'Revuelto'],
  },
  {
    slug: 'mclaren',
    label: 'مک‌لارن',
    latin: 'McLaren',
    models: ['720S', '570S', 'Artura', 'GT', '765LT'],
  },
  {
    slug: 'ferrari',
    label: 'فراری',
    latin: 'Ferrari',
    models: ['488 GTB', 'F8 Tributo', 'Roma', 'Portofino', 'SF90'],
  },
  {
    slug: 'bentley',
    label: 'بنتلی',
    latin: 'Bentley',
    models: ['Continental GT', 'Bentayga', 'Flying Spur', 'Mulsanne'],
  },
  {
    slug: 'rolls-royce',
    label: 'رولز-رویس',
    latin: 'Rolls-Royce',
    models: ['Ghost', 'Phantom', 'Cullinan', 'Wraith', 'Dawn'],
  },
  {
    slug: 'aston-martin',
    label: 'استون مارتین',
    latin: 'Aston Martin',
    models: ['DB11', 'Vantage', 'DBX', 'DBS', 'Rapide'],
  },
  { slug: 'other', label: 'سایر', latin: 'Other', models: [] },
  ...MOTORCYCLE_BRANDS,
  ...HEAVY_BRANDS,
] as const satisfies readonly CategoryBrand[];

/**
 * Marques retired from the browse catalogue.
 *
 * The domestic Iranian brands (and the Iran-assembled French models) no longer
 * appear in the brand box, but rows already stored with them must keep
 * validating, rendering and editing — so their slugs stay in the enum and in
 * the label maps, they are simply never offered as a choice again.
 */
export const LEGACY_BRANDS = [
  { slug: 'ikco', label: 'ایران‌خودرو', latin: 'IKCO', models: ['206', '207', 'Pars', 'Samand', 'Dena', 'Rana', 'Tara'] },
  { slug: 'saipa', label: 'سایپا', latin: 'SAIPA', models: ['Pride', 'Tiba', 'Quick', 'Shahin', 'Saina', 'Atlas'] },
  { slug: 'parskhodro', label: 'پارس‌خودرو', latin: 'Pars Khodro', models: ['Tondar 90', 'Sandero'] },
  { slug: 'pars-khodro', label: 'پارس خودرو (سابق)', latin: 'Pars Khodro (legacy)', models: ['Tondar 90', 'Sandero'] },
  { slug: 'kermankhodro', label: 'کرمان‌خودرو', latin: 'Kerman Khodro', models: ['J4', 'S3', 'S5', 'Arrizo 5', 'Tiggo 7'] },
  { slug: 'bahman', label: 'بهمن‌موتور', latin: 'Bahman Motor', models: ['Mazda 3', '320i', 'Golf'] },
  { slug: 'mvm', label: 'ام‌وی‌ام', latin: 'MVM', models: ['315', '530', '550', 'X22', 'X33', 'X55'] },
  { slug: 'peugeot', label: 'پژو', latin: 'Peugeot', models: ['206', '207', '405', 'Pars', '2008', '3008', '5008', '508'] },
  { slug: 'renault', label: 'رنو', latin: 'Renault', models: ['Megane', 'Fluence', 'Koleos', 'Duster', 'Sandero', 'Captur'] },
] as const satisfies readonly CategoryBrand[];

/** Every accepted slug: the browse catalogue plus the retired marques. */
export const ALL_BRANDS = [...BRANDS, ...LEGACY_BRANDS] as const;

export type BrandSlug = (typeof ALL_BRANDS)[number]['slug'];

export const brandSlugs = ALL_BRANDS.map((b) => b.slug) as [BrandSlug, ...BrandSlug[]];

/** Latin marque name per slug — the card's top line (always rendered LTR). */
export const BRAND_LATIN: Record<string, string> = Object.fromEntries(
  ALL_BRANDS.map((b) => [b.slug, b.latin]),
);

/** Persian label per slug (motorcycle, heavy and legacy brands included). */
export const BRAND_NAME: Record<string, string> = Object.fromEntries(
  ALL_BRANDS.map((b) => [b.slug, b.label]),
);

/**
 * Brand order in the vehicles brand box — luxury/import first (what the Kish
 * free zone actually sells), the budget import set after it. `سایر` closes it.
 */
export const CAR_UI_BRAND_SLUGS = [
  'toyota',
  'nissan',
  'lexus',
  'infiniti',
  'mercedes-benz',
  'bmw',
  'audi',
  'porsche',
  'volkswagen',
  'mini',
  'volvo',
  'jaguar',
  'land-rover',
  'range-rover',
  'lamborghini',
  'mclaren',
  'ferrari',
  'bentley',
  'rolls-royce',
  'aston-martin',
  'maserati',
  'cadillac',
  'ford',
  'chevrolet',
  'dodge',
  'jeep',
  'tesla',
  'hyundai',
  'kia',
  'genesis',
  'honda',
  'mazda',
  'mitsubishi',
  'subaru',
  'mg',
  'chery',
  'geely',
  'byd',
  'haval',
  'jac',
  'changan',
  'lifan',
  'fiat',
  'opel',
  'other',
] as const;

/** Cars only, in brand-box order. */
export const carBrands: readonly CategoryBrand[] = CAR_UI_BRAND_SLUGS.map(
  (slug: (typeof CAR_UI_BRAND_SLUGS)[number]) => ALL_BRANDS.find((b) => b.slug === slug)!,
).filter(Boolean);

/** Legacy alias kept for the pages that already import it. */
export const KISH_UI_BRAND_SLUGS = CAR_UI_BRAND_SLUGS;
export const kishUiBrands = carBrands;

/** Brand list for a category — cars, motorcycles or heavy machinery. */
export function brandsForCategory(category: 'car' | 'motorcycle' | 'heavy'): readonly CategoryBrand[] {
  if (category === 'motorcycle') return MOTORCYCLE_BRANDS;
  if (category === 'heavy') return HEAVY_BRANDS;
  return carBrands;
}

/** Suggestion models for one brand slug (empty when the brand is «سایر»). */
export function modelsForBrand(slug: string): readonly string[] {
  const brand = ALL_BRANDS.find((b) => b.slug === slug);
  return (brand?.models ?? []) as readonly string[];
}

/**
 * Launch cities — Kish first (launch region).
 *
 * `countyId` is the reference.gov.ir county code (same source as
 * `listings.city` seed data); null where the county is not yet mapped.
 * Consumed by `selectableCities()` in ./features while the `city_selection`
 * flag is off — the catalog stays complete (D1) and every code path derives
 * its active list from the flag instead of hardcoding a subset.
 */
export const CITIES = [
  { slug: 'kish', label: 'کیش', countyId: '1220003' },
  { slug: 'tehran', label: 'تهران', countyId: null },
  { slug: 'mashhad', label: 'مشهد', countyId: null },
  { slug: 'isfahan', label: 'اصفهان', countyId: null },
  { slug: 'shiraz', label: 'شیراز', countyId: null },
  { slug: 'tabriz', label: 'تبریز', countyId: null },
  { slug: 'ahvaz', label: 'اهواز', countyId: null },
  { slug: 'rasht', label: 'رشت', countyId: null },
  { slug: 'kerman', label: 'کرمان', countyId: null },
  { slug: 'yazd', label: 'یزد', countyId: null },
  { slug: 'bandar-abbas', label: 'بندرعباس', countyId: null },
] as const;

export const citySlugs = CITIES.map((c) => c.slug);

/**
 * Vehicle model year — the Gregorian (میلادی) year, stored as one integer.
 *
 * Kish inventory is quoted in میلادی («مدل ۲۰۲۲»), so the picker offers 2026
 * back to 1990 and the number on the card, the filter and the detail header is
 * the same integer. The Jalali (شمسی) equivalent is shown beside it for Persian
 * readers; the lunar Hijri calendar is never used for model years. The lower
 * bound stays permissive (1300) so rows stored under the old Jalali picker keep
 * validating and rendering instead of breaking on load.
 */
export const MIN_VEHICLE_YEAR = 1300;
export const MAX_VEHICLE_YEAR = 2030;

export const LATEST_VEHICLE_YEAR = 2026;
export const OLDEST_VEHICLE_YEAR = 1990;
export const VEHICLE_YEARS: readonly number[] = Array.from(
  { length: LATEST_VEHICLE_YEAR - OLDEST_VEHICLE_YEAR + 1 },
  (_, i) => LATEST_VEHICLE_YEAR - i,
);

/**
 * Gregorian → Jalali model year (year granularity).
 *
 * A model year is a year, not a date: the Persian year that starts in that
 * March is `gy − 621`. Exact enough for «مدل ۲۰۲۲ / ۱۴۰۱», and reversible.
 */
export function gregorianToJalaliYear(gregorianYear: number): number {
  return gregorianYear - 621;
}

/** Jalali → Gregorian model year. */
export function jalaliToGregorianYear(jalaliYear: number): number {
  return jalaliYear + 621;
}

/** Jalali years the picker can show, newest first (mirror of VEHICLE_YEARS). */
export const JALALI_VEHICLE_YEARS: readonly number[] = VEHICLE_YEARS.map(gregorianToJalaliYear);

export const vehicleSchema = z.object({
  brand: z.enum(brandSlugs),
  model: z.string().trim().min(1).max(60),
  trim: z.string().trim().max(60).nullable().default(null),
  year: z.number().int().min(MIN_VEHICLE_YEAR).max(MAX_VEHICLE_YEAR),
  mileageKm: z.number().int().min(0).max(2_000_000),
  /**
   * Gearbox is no longer asked in the form; it defaults to automatic so rows
   * created before and after the form change validate the same way.
   */
  gearbox: z.enum(gearboxTypes).default('automatic'),
  fuel: z.enum(fuelTypes),
  /**
   * Free-text colour («سفید صدفی، مشکی متالیک…»). Legacy colour slugs still
   * validate because they are plain strings; `colorLabel()` translates them.
   */
  color: z.string().trim().max(40),
  /** Standard body class (تیپ / کلاس بدنه) — optional for old rows. */
  bodyType: z.enum(bodyTypes).nullable().default(null),
  condition: z.enum(conditions),
  plateType: z.enum(['standard', 'kish', 'temporary_transit', 'unplated'] as const),
  vin: z
    .string()
    .trim()
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/, 'must be 17-char VIN (no I/O/Q)')
    .nullable()
    .default(null),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;

/**
 * Body class inferred from a model name.
 *
 * Listings created before the body-class picker have no `bodyType`; without a
 * hint the drawer's «شاسی‌بلند» / «سدان» shortcuts would always be empty. The
 * keywords cover the catalogue's actual models and only ever supplement a
 * missing value — an explicit pick always wins.
 */
const BODY_TYPE_HINTS: ReadonlyArray<[BodyType, readonly string[]]> = [
  ['pickup', ['hilux', 'f-150', 'f150', 'ram', 'silverado', 'l200', 'gladiator', 'tundra']],
  ['van', ['v-class', 'v class', 'odyssey', 'sienna', 'carnival', 'transporter']],
  ['convertible', ['boxster', 'convertible', 'cabriolet', 'spyder', 'roadster']],
  [
    'coupe',
    ['supra', '370z', 'gt-r', 'gtr', 'amg gt', '911', 'cayman', 'huracan', 'aventador', '720s', '570s', 'artura', '765lt', '488', 'f8', 'roma', 'portofino', 'sf90', 'db11', 'vantage', 'dbs', 'rapide', 'mustang', 'camaro', 'corvette', 'challenger', 'charger'],
  ],
  [
    'suv',
    ['land cruiser', 'prado', 'patrol', 'x5', 'x6', 'x7', 'x1', 'x3', 'gle', 'gls', 'glc', 'g-class', 'rx', 'nx', 'gx', 'lx', 'qx', 'cayenne', 'macan', 'touareg', 'tiguan', 'x-trail', 'qashqai', 'cr-v', 'pilot', 'hr-v', 'cx-5', 'cx-9', 'outlander', 'pajero', 'forester', 'outback', 'xv', 'xc40', 'xc60', 'xc90', 'range rover', 'defender', 'discovery', 'evoque', 'velar', 'escalade', 'tahoe', 'explorer', 'expedition', 'bronco', 'wrangler', 'grand cherokee', 'compass', 'cherokee', 'tucson', 'santa fe', 'palisade', 'kona', 'sportage', 'sorento', 'telluride', 'tiggo', 'h6', 'h9', 'jolion', 'dargo', 'coolray', 'tugella', 'okavango', 'atlas', 'cs35', 'cs55', 'cs75', 'uni-t', 'x50', 'x60', 'x70', 's3', 's5', 'j4', 't8', 'urus', 'bentayga', 'cullinan', 'dbx', 'qx80'],
  ],
  ['hatchback', ['golf', 'cooper', 'picanto', '206', '207', 'panda', '500', 'corsa', 'i20']],
  [
    'sedan',
    ['camry', 'corolla', 'accord', 'civic', 'mazda 3', 'mazda 6', 's-class', 'e-class', 'c-class', '3 series', '5 series', '7 series', 'a4', 'a6', 'a8', 'passat', 's60', 's90', 'xe', 'xf', 'ghibli', 'quattroporte', 'ct4', 'ct5', 'malibu', 'sonata', 'elantra', 'accent', 'optima', 'k5', 'cerato', 'stinger', 'g70', 'g80', 'g90', 'mg5', 'mg6', 'arrizo', 'tondar', 'altima', 'maxima'],
  ],
];

export function inferBodyType(model: string | null | undefined): BodyType | null {
  const text = (model ?? '').toLowerCase();
  if (!text) return null;
  for (const [body, hints] of BODY_TYPE_HINTS) {
    if (hints.some((hint) => text.includes(hint))) return body;
  }
  return null;
}

/**
 * Map a free-text colour back onto the legacy `color_slug` enum.
 *
 * The hosted `vehicles.color` column is still an enum (the demo store keeps
 * the seller's exact words), so the publish path narrows the value instead of
 * failing the insert. Unrecognised text lands on `other`.
 */
export function toLegacyColorSlug(value: string | null | undefined): (typeof colorSlugs)[number] {
  const raw = (value ?? '').trim().toLowerCase();
  if (!raw) return 'other';
  if ((colorSlugs as readonly string[]).includes(raw)) return raw as (typeof colorSlugs)[number];
  const known: ReadonlyArray<[(typeof colorSlugs)[number], readonly string[]]> = [
    ['white', ['سفید', 'صدفی']],
    ['black', ['مشکی', 'سیاه']],
    ['silver', ['نقره']],
    ['gray', ['خاکستری', 'طوسی', 'خاکسترى']],
    ['red', ['قرمز', 'قرمزى', 'شرابی']],
    ['blue', ['آبی', 'ابی', 'سرمه']],
    ['green', ['سبز']],
    ['beige', ['بژ', 'کرم']],
    ['brown', ['قهوه', 'نسکافه']],
    ['gold', ['طلایی', 'طلا']],
    ['orange', ['نارنجی']],
  ];
  for (const [slug, words] of known) {
    if (words.some((word) => raw.includes(word))) return slug;
  }
  return 'other';
}

export { vehicleCategories };
