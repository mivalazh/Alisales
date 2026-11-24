import { z } from 'zod';
import {
  bodyTypes,
  chassisConditions,
  colorSlugs,
  conditions,
  fuelTypes,
  gearboxTypes,
  paintConditions,
  type BodyType,
} from './enums';
import {
  HEAVY_BRANDS,
  MOTORCYCLE_BRANDS,
  vehicleCategories,
  type CategoryBrand,
} from './categories';
import { CAR_BRANDS } from './car-brands';

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
export const BRANDS = CAR_BRANDS as readonly CategoryBrand[];

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
export const CAR_UI_BRAND_SLUGS = CAR_BRANDS.map((brand) => brand.slug) as readonly string[];

/** Cars only, in brand-box order. */
export const carBrands: readonly CategoryBrand[] = CAR_UI_BRAND_SLUGS.map(
  (slug) => ALL_BRANDS.find((b) => b.slug === slug)!,
).filter(Boolean);

/** Legacy alias kept for the pages that already import it. */
export const KISH_UI_BRAND_SLUGS = CAR_UI_BRAND_SLUGS;
export const kishUiBrands = carBrands;

/** Brand list for a category — cars, motorcycles or heavy machinery. */
export function brandsForCategory(category: 'car' | 'motorcycle' | 'heavy'): readonly CategoryBrand[] {
  const list =
    category === 'motorcycle' ? MOTORCYCLE_BRANDS : category === 'heavy' ? HEAVY_BRANDS : carBrands;
  // Petrol bikes and the old HOWO truck stay in the schema for existing rows,
  // but the new Kish catalog offers only the exact electric/heavy list.
  return list.filter((brand) => !brand.legacy);
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
  /** Third-party insurance: yes/no + remaining months (1–12). */
  thirdPartyInsurance: z.boolean().nullable().default(null),
  thirdPartyMonths: z.number().int().min(1).max(12).nullable().default(null),
  /** Body insurance: yes/no + remaining months (1–12). */
  bodyInsurance: z.boolean().nullable().default(null),
  bodyMonths: z.number().int().min(1).max(12).nullable().default(null),
  /** Seller-declared paint / body condition. */
  paintCondition: z.enum(paintConditions).nullable().default(null),
  /** Seller-declared chassis condition. */
  chassisCondition: z.enum(chassisConditions).nullable().default(null),
  /** Current technical inspection (معاینه فنی) on/off. */
  technicalInspection: z.boolean().nullable().default(null),
  /** «عکس ژورنال» — the cover is a catalogue/internet photo, not the car. */
  isJournalPhoto: z.boolean().default(false),
  /** Optional uploaded inspection sheet + the seller's summary line. */
  inspectionSheetUrl: z.string().trim().max(500).nullable().default(null),
  inspectionNote: z.string().trim().max(300).nullable().default(null),
  vin: z
    .string()
    .trim()
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/, 'must be 17-char VIN (no I/O/Q)')
    .nullable()
    .default(null),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;

/**
 * Every car body group, and the body-class inference, in one table.
 *
 * There used to be two lists: `BODY_TYPE_HINTS` here — which decides the
 * stored `vehicles.body_type` and is mirrored by the SQL migrations — and
 * `CAR_BODY_TYPES` in the web app's browse module, which only narrows a grid.
 * They shared models but not keywords, so «x7» was an SUV to the database and
 * invisible in the SUV chip, and every new car had to be added twice. This is
 * now the only keyword list: the browse groups are derived from it
 * (`apps/web/lib/browse.ts`), and so is `BODY_TYPE_HINTS` below.
 *
 *  - `keywords` are model/trim words that BOTH narrow the browse chip and
 *    decide the stored class. They are what 0016/0022 mirror in SQL.
 *  - `browseOnly` words narrow the chip and never classify: literals a seller
 *    types («suv», «هاچ‌بک»), the «sport» alias, and the few models whose class
 *    the inference must not change (the hatchback chip lists «cerato» without
 *    overriding the sedan inference, which owns it).
 *  - `browseOrder` is the drawer-menu order; `null` means the class has no chip
 *    (pickup/van/convertible are inference-only today).
 *
 * Table order is the inference order — first match wins — and it is pinned to
 * the SQL by `tests/body-type-hints-drift.test.ts`. `crossover` is a real
 * `bodyType` a seller can pick, but no hint ever infers it: its keywords are
 * all SUV hints, and assigning the class behind the seller's back would move
 * rows between two stored values. Hence `bodyType: null` on that group.
 */
export interface CarBodyGroup {
  key: string;
  label: string;
  /** Stored class this group's `keywords` infer, or null for browse-only. */
  bodyType: BodyType | null;
  keywords: readonly string[];
  browseOnly?: readonly string[];
  browseOrder: number | null;
}

export const CAR_BODY_GROUPS: readonly CarBodyGroup[] = [
  // «ram» alone matched any model containing those three letters, so the pickups
  // are named by their model instead: a bare «Ram» is unknown, not a guess.
  {
    key: 'pickup',
    label: 'پیکاپ / وانت',
    bodyType: 'pickup',
    browseOrder: null,
    keywords: ['hilux', 'f-150', 'f150', 'ram 1500', 'ram 2500', 'ram 3500', 'ram trx', 'silverado', 'l200', 'gladiator', 'tundra'],
  },
  {
    key: 'van',
    label: 'ون',
    bodyType: 'van',
    browseOrder: null,
    keywords: ['v-class', 'v class', 'odyssey', 'sienna', 'carnival', 'transporter'],
  },
  {
    key: 'convertible',
    label: 'کروک / کانورتیبل',
    bodyType: 'convertible',
    browseOrder: null,
    keywords: ['boxster', 'convertible', 'cabriolet', 'spyder', 'roadster'],
  },
  {
    key: 'coupe',
    label: 'کوپه و اسپرت',
    bodyType: 'coupe',
    browseOrder: 4,
    keywords: ['supra', '370z', 'gt-r', 'gtr', 'amg gt', '911', 'cayman', 'huracan', 'aventador', '720s', '570s', 'artura', '765lt', '488', 'f8', 'roma', 'portofino', 'sf90', 'db11', 'vantage', 'dbs', 'rapide', 'mustang', 'camaro', 'corvette', 'challenger', 'charger'],
    // «sport» stays browse-only: a stored class must not come from a trim word
    // («F-Sport», «Sportster» are not coupes).
    browseOnly: ['coupe', 'کوپه', 'sport', 'اسپرت', 'm4', 'c63'],
  },
  {
    key: 'suv',
    label: 'SUV',
    bodyType: 'suv',
    browseOrder: 1,
    keywords: ['land cruiser', 'prado', 'patrol', 'x5', 'x6', 'x7', 'x1', 'x3', 'gle', 'gls', 'glc', 'g-class', 'rx', 'nx', 'gx', 'lx', 'qx', 'cayenne', 'macan', 'touareg', 'tiguan', 'x-trail', 'qashqai', 'cr-v', 'pilot', 'hr-v', 'cx-5', 'cx-9', 'outlander', 'pajero', 'forester', 'outback', 'xv', 'xc40', 'xc60', 'xc90', 'range rover', 'defender', 'discovery', 'evoque', 'velar', 'escalade', 'tahoe', 'explorer', 'expedition', 'bronco', 'wrangler', 'grand cherokee', 'compass', 'cherokee', 'tucson', 'santa fe', 'palisade', 'kona', 'sportage', 'sorento', 'telluride', 'tiggo', 'h6', 'h9', 'jolion', 'dargo', 'coolray', 'tugella', 'okavango', 'atlas', 'cs35', 'cs55', 'cs75', 'uni-t', 'x50', 'x60', 'x70', 's3', 's5', 'j4', 't8', 'urus', 'bentayga', 'cullinan', 'dbx', 'qx80'],
    // «fortuner» is a real SUV the class table has not learned yet; the chip
    // knowing it must not mean the column starts guessing.
    browseOnly: ['suv', 'fortuner'],
  },
  // No bare «500»: it also matched «S 500» and «GLE 500». The Fiat needs its
  // brand in the model now; an unmatched 500 stays unknown instead.
  {
    key: 'hatchback',
    label: 'هاچ‌بک',
    bodyType: 'hatchback',
    browseOrder: 3,
    keywords: ['golf', 'cooper', 'picanto', '206', '207', 'panda', 'fiat 500', 'corsa', 'i20'],
    // «cerato» is a sedan hint below; listing it here keeps the hatchback chip's
    // old reach without moving the stored class.
    browseOnly: ['hatchback', 'هاچبک', 'cerato'],
  },
  {
    key: 'sedan',
    label: 'سدان',
    bodyType: 'sedan',
    browseOrder: 2,
    keywords: ['camry', 'corolla', 'accord', 'civic', 'mazda 3', 'mazda 6', 's-class', 'e-class', 'c-class', '3 series', '5 series', '7 series', 'a4', 'a6', 'a8', 'passat', 's60', 's90', 'xe', 'xf', 'ghibli', 'quattroporte', 'ct4', 'ct5', 'malibu', 'sonata', 'elantra', 'accent', 'optima', 'k5', 'cerato', 'stinger', 'g70', 'g80', 'g90', 'mg5', 'mg6', 'arrizo', 'tondar', 'altima', 'maxima'],
    browseOnly: ['sedan', 'teana'],
  },
  {
    key: 'crossover',
    label: 'کراس‌اوور',
    bodyType: null,
    browseOrder: 5,
    keywords: ['crossover', 'کراساوور', 'hr-v', 'cx-5', 'qashqai', 'creta', 'seltos', 'juke'],
  },
  {
    key: 'luxury',
    label: 'لوکس و لیموزین',
    bodyType: null,
    browseOrder: 6,
    keywords: [
      'luxury',
      'limousine',
      'لیموزین',
      's-class',
      '7 series',
      'a8',
      'range rover',
      'bentley',
      'rolls',
      'porsche',
      'panamera',
      'lexus',
    ],
  },
  {
    key: 'hybrid',
    label: 'خودروی برقی و هیبرید',
    bodyType: null,
    browseOrder: 7,
    keywords: ['hybrid', 'هیبرید', 'electric', 'برقی', 'ev', 'tesla', 'priya', 'prius', 'byd'],
  },
];

/**
 * The inference view of the table: `(body class, keywords)` in table order.
 *
 * This is the array the SQL migrations mirror (0016 shipped it, 0022 re-infers
 * with it) and `tests/body-type-hints-drift.test.ts` compares against, so its
 * order and contents must stay in step with `CAR_BODY_GROUPS` — which they are
 * by construction.
 */
export const BODY_TYPE_HINTS: ReadonlyArray<[BodyType, readonly string[]]> =
  CAR_BODY_GROUPS.flatMap((group): Array<[BodyType, readonly string[]]> =>
    group.bodyType ? [[group.bodyType, group.keywords]] : [],
  );

/**
 * One keyword matcher for inference and browsing: lowercase substring.
 *
 * Both sides must agree or a car can be an SUV in the column and invisible in
 * the SUV chip; this is the single comparison they call.
 */
export function matchesBodyKeyword(haystack: string | null | undefined, keywords: readonly string[]): boolean {
  const text = (haystack ?? '').toLowerCase();
  if (!text) return false;
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

/**
 * Every curated chip a model belongs to, as drawer keys in menu order.
 *
 * This is the value the prototype stores in `vehicles.browse_groups`
 * (0024) so `?body=` can be one GIN-indexed containment test instead of a
 * scan over keyword `ilike`. It uses the same haystack and the same matcher as
 * `filterByBodyType` (model + trim, `keywords ∪ browseOnly`), so the stored
 * array and the browser predicate cannot disagree; a motorcycle or machine is
 * the caller's job to keep out (the chips are car classes).
 */
export function browseGroupsFor(
  model: string | null | undefined,
  trim?: string | null,
): string[] {
  const haystack = `${model ?? ''} ${trim ?? ''}`;
  return CAR_BODY_GROUPS.filter(
    (group) =>
      group.browseOrder !== null &&
      matchesBodyKeyword(haystack, [...group.keywords, ...(group.browseOnly ?? [])]),
  )
    .sort((a, b) => (a.browseOrder ?? 0) - (b.browseOrder ?? 0))
    .map((group) => group.key);
}

export function inferBodyType(model: string | null | undefined): BodyType | null {
  if (!model) return null;
  for (const [body, hints] of BODY_TYPE_HINTS) {
    if (matchesBodyKeyword(model, hints)) return body;
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
