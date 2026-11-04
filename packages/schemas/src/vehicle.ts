import { z } from 'zod';
import { colorSlugs, conditions, fuelTypes, gearboxTypes } from './enums';
import {
  HEAVY_BRANDS,
  MOTORCYCLE_BRANDS,
  vehicleCategories,
  type CategoryBrand,
} from './categories';

/**
 * Market brands (Iran + Kish free zone import market).
 *
 * Every brand shows a Latin marque name (`latin`) as well as its Persian label:
 * the card prints the Latin name above the model, always `dir="ltr"`, so a
 * mixed RTL/LTR title never reorders.
 *
 * The catalogue covers what is actually sold in the Iranian market — domestic
 * Iranian marques, the Chinese/Korean/Japanese imports and the European luxury
 * set — in the order the brand box lists them. `models` stays a suggestion
 * list: model (and a custom brand) remain free text.
 */
export const BRANDS = [
  {
    slug: 'ikco',
    label: 'ایران‌خودرو',
    latin: 'IKCO',
    models: [
      'پژو ۲۰۶',
      'پژو ۲۰۷',
      'پژو پارس',
      'پژو ۴۰۵',
      'دنا',
      'دنا پلاس',
      'رانا',
      'سمند',
      'هایما S7',
      'تارا',
    ],
  },
  { slug: 'saipa', label: 'سایپا', latin: 'SAIPA', models: ['پراید', 'تیبا', 'کوییک', 'شاهین', 'ساینا', 'اطلس'] },
  { slug: 'parskhodro', label: 'پارس‌خودرو', latin: 'Pars Khodro', models: ['تندر ۹۰', 'ساندرو', 'رنو پارس تندر'] },
  { slug: 'pars-khodro', label: 'پارس خودرو (سابق)', latin: 'Pars Khodro (legacy)', models: ['تندر ۹۰', 'ساندرو'] },
  { slug: 'kermankhodro', label: 'کرمان‌خودرو', latin: 'Kerman Khodro', models: ['جک J4', 'جک S3', 'جک S5', 'آریزو ۵', 'تیگو ۷'] },
  { slug: 'bahman', label: 'بهمن‌موتور', latin: 'Bahman Motor', models: ['مزدا ۳', 'بی‌ام‌و ۳۲۰i', 'فولکس‌واگن گل'] },
  {
    slug: 'kia',
    label: 'کیا',
    latin: 'Kia',
    models: ['سراتو', 'پیکانتو', 'اسپورتیج', 'سورنتو', 'Cerato', 'Sportage', 'Optima', 'K5', 'Sorento', 'Telluride'],
  },
  {
    slug: 'hyundai',
    label: 'هیوندای',
    latin: 'Hyundai',
    models: ['اکسنت', 'النترا', 'سوناتا', 'توسان', 'Accent', 'Elantra', 'Sonata', 'Tucson', 'Santa Fe', 'Palisade'],
  },
  {
    slug: 'peugeot',
    label: 'پژو',
    latin: 'Peugeot',
    models: ['206', '207', '405', 'Pars', '2008', '3008', '5008', '508'],
  },
  { slug: 'renault', label: 'رنو', latin: 'Renault', models: ['مگان', 'فلوئنس', 'کولیوس', 'Duster', 'Sandero', 'Captur'] },
  { slug: 'chery', label: 'چری', latin: 'Chery', models: ['آریزو ۶', 'تیگو ۸', 'Tiggo 7 Pro', 'Tiggo 8 Pro', 'Arrizo 8'] },
  { slug: 'mvm', label: 'ام‌وی‌ام', latin: 'MVM', models: ['315', '530', '550', 'X22', 'X33', 'X55'] },
  {
    slug: 'nissan',
    label: 'نیسان',
    latin: 'Nissan',
    models: ['Patrol', 'Altima', 'Maxima', 'GT-R', 'X-Trail', 'Sunny', 'Juke', 'Qashqai', 'Z370'],
  },
  {
    slug: 'toyota',
    label: 'تویوتا',
    latin: 'Toyota',
    models: [
      'کرولا',
      'کمری',
      'هاچ',
      'RAV4',
      'لندکروزر',
      'Corolla',
      'Camry',
      'Land Cruiser',
      'Land Cruiser Prado',
      'Prado',
      'Hilux',
      'Fortuner',
      'C-HR',
      'Supra',
    ],
  },
  { slug: 'honda', label: 'هوندا', latin: 'Honda', models: ['Accord', 'Civic', 'CR-V', 'Pilot', 'HR-V'] },
  {
    slug: 'mercedes-benz',
    label: 'مرسدس‌بنز',
    latin: 'Mercedes-Benz',
    models: ['کلاس C', 'کلاس E', 'GLC', 'C-Class', 'E-Class', 'S-Class', 'GLE', 'G-Class', 'S 500'],
  },
  {
    slug: 'bmw',
    label: 'بی‌ام‌و',
    latin: 'BMW',
    models: ['سری ۳', 'سری ۵', 'X1', 'X3', '3 Series', '5 Series', '7 Series', 'X5', 'X6', 'M5'],
  },
  {
    slug: 'audi',
    label: 'آئودی',
    latin: 'Audi',
    models: ['A4', 'A6', 'A8', 'Q5', 'Q7', 'Q8', 'RS7', 'e-tron'],
  },
  {
    slug: 'volkswagen',
    label: 'فولکس‌واگن',
    latin: 'Volkswagen',
    models: ['Golf', 'Tiguan', 'Passat', 'Touareg', 'Arteon', 'ID.4'],
  },
  { slug: 'porsche', label: 'پورشه', latin: 'Porsche', models: ['Cayenne', 'Macan', 'Panamera', '911', 'Boxster'] },
  { slug: 'lexus', label: 'لکسوس', latin: 'Lexus', models: ['LX', 'RX', 'ES', 'NX', 'GX', 'LX 570'] },
  {
    slug: 'land-rover',
    label: 'لندروور',
    latin: 'Land Rover',
    models: ['Range Rover', 'Range Rover Sport', 'Discovery', 'Defender', 'Evoque'],
  },
  {
    slug: 'range-rover',
    label: 'رنج‌روور',
    latin: 'Range Rover',
    models: ['Vogue', 'Sport', 'Velar', 'Evoque', 'Autobiography'],
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
  { slug: 'dodge', label: 'دوج', latin: 'Dodge', models: ['Challenger', 'Charger', 'Durango', 'Ram 1500'] },
  {
    slug: 'jeep',
    label: 'جیپ',
    latin: 'Jeep',
    models: ['Wrangler', 'Grand Cherokee', 'Compass', 'Cherokee', 'Gladiator'],
  },
  { slug: 'mazda', label: 'مزدا', latin: 'Mazda', models: ['مزدا ۲', 'مزدا ۳', 'CX-5', 'CX-9', 'MX-5'] },
  {
    slug: 'mitsubishi',
    label: 'میتسوبیشی',
    latin: 'Mitsubishi',
    models: ['Pajero', 'L200', 'Outlander', 'Eclipse Cross', 'ASX'],
  },
  { slug: 'subaru', label: 'سوبارو', latin: 'Subaru', models: ['Forester', 'Outback', 'Impreza', 'XV', 'WRX'] },
  { slug: 'geely', label: 'جیلی', latin: 'Geely', models: ['Emgrand 7', 'Coolray', 'Tugella', 'Okavango', 'Atlas'] },
  { slug: 'byd', label: 'بی‌وای‌دی', latin: 'BYD', models: ['F0', 'F3', 'S6', 'Song Plus', 'Seal', 'Atto 3'] },
  { slug: 'haval', label: 'هاول', latin: 'Haval', models: ['H6', 'H9', 'Jolion', 'Dargo', 'H6 GT'] },
  { slug: 'jac', label: 'جک', latin: 'JAC', models: ['S3', 'S5', 'J4', 'T8', 'Sehol X4'] },
  { slug: 'lifan', label: 'لیفان', latin: 'Lifan', models: ['X50', 'X60', 'X70', '820', '620'] },
  { slug: 'changan', label: 'چانگان', latin: 'Changan', models: ['CS35', 'CS55', 'CS75', 'Eado', 'UNI-T'] },
  { slug: 'tesla', label: 'تسلا', latin: 'Tesla', models: ['Model 3', 'Model Y', 'Model S', 'Model X'] },
  { slug: 'mg', label: 'ام‌جی', latin: 'MG', models: ['MG5', 'MG6', 'ZS', 'HS', 'RX5'] },
  {
    slug: 'infiniti',
    label: 'اینفینیتی',
    latin: 'Infiniti',
    models: ['Q50', 'Q60', 'QX50', 'QX60', 'QX80'],
  },
  {
    slug: 'cadillac',
    label: 'کادیلاک',
    latin: 'Cadillac',
    models: ['Escalade', 'CT4', 'CT5', 'XT5', 'XT6'],
  },
  { slug: 'genesis', label: 'جنسیس', latin: 'Genesis', models: ['G70', 'G80', 'G90', 'GV70', 'GV80'] },
  { slug: 'volvo', label: 'ولوو', latin: 'Volvo', models: ['XC40', 'XC60', 'XC90', 'S60', 'S90'] },
  { slug: 'jaguar', label: 'جگوار', latin: 'Jaguar', models: ['XE', 'XF', 'F-Pace', 'E-Pace', 'F-Type'] },
  { slug: 'mini', label: 'مینی', latin: 'MINI', models: ['Cooper', 'Countryman', 'Clubman', 'John Cooper Works'] },
  { slug: 'fiat', label: 'فیات', latin: 'Fiat', models: ['500', 'Tipo', 'Panda', 'Doblo'] },
  { slug: 'opel', label: 'اپل', latin: 'Opel', models: ['Astra', 'Corsa', 'Insignia', 'Mokka', 'Grandland'] },
  {
    slug: 'maserati',
    label: 'مازراتی',
    latin: 'Maserati',
    models: ['Ghibli', 'Levante', 'Quattroporte', 'GranTurismo', 'MC20'],
  },
  { slug: 'other', label: 'سایر', latin: 'Other', models: [] },
  ...MOTORCYCLE_BRANDS,
  ...HEAVY_BRANDS,
] as const satisfies readonly CategoryBrand[];

export type BrandSlug = (typeof BRANDS)[number]['slug'];

export const brandSlugs = BRANDS.map((b) => b.slug) as [BrandSlug, ...BrandSlug[]];

/** Latin marque name per slug — the card's top line (always rendered LTR). */
export const BRAND_LATIN: Record<string, string> = Object.fromEntries(
  BRANDS.map((b) => [b.slug, b.latin]),
);

/** Persian label per slug (motorcycle and heavy brands included). */
export const BRAND_NAME: Record<string, string> = Object.fromEntries(
  BRANDS.map((b) => [b.slug, b.label]),
);

/**
 * Brand order in the vehicles brand box — the Iranian market list: domestic
 * marques, then the import set buyers actually search for. `سایر` closes it.
 */
export const CAR_UI_BRAND_SLUGS = [
  'ikco',
  'saipa',
  'parskhodro',
  'kia',
  'hyundai',
  'peugeot',
  'renault',
  'chery',
  'mvm',
  'nissan',
  'toyota',
  'honda',
  'mercedes-benz',
  'bmw',
  'audi',
  'volkswagen',
  'porsche',
  'lexus',
  'land-rover',
  'range-rover',
  'ford',
  'chevrolet',
  'dodge',
  'jeep',
  'mazda',
  'mitsubishi',
  'subaru',
  'geely',
  'byd',
  'haval',
  'jac',
  'lifan',
  'changan',
  'tesla',
  'mg',
  'infiniti',
  'cadillac',
  'genesis',
  'volvo',
  'jaguar',
  'mini',
  'fiat',
  'opel',
  'maserati',
  'other',
] as const;

/** Cars only, in brand-box order. */
export const carBrands: readonly CategoryBrand[] = CAR_UI_BRAND_SLUGS.map(
  (slug) => BRANDS.find((b) => b.slug === slug)!,
).filter(Boolean);

/**
 * Legacy export kept for the pages that already import it. It is now the full
 * car catalogue (the old 20-item import-only subset was too narrow).
 */
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
  return BRANDS.find((b) => b.slug === slug)?.models ?? [];
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
 * Vehicle model year — stored as the Hijri Qamari (lunar) year the form's
 * picker offers, so one integer is the count on the card, the filter and the
 * detail header alike. 1300 keeps legacy rows valid; the upper bound covers
 * the current Qamari decade (1448 ≈ 2026 CE).
 */
export const MIN_VEHICLE_YEAR = 1300;
export const MAX_VEHICLE_YEAR = 1460;

/**
 * Qamari years the form offers, newest first: 1448 (2026 CE) back to 1395
 * (≈1975 CE). Older rows stay valid through `MIN_VEHICLE_YEAR`.
 */
export const QAMARI_NEWEST_YEAR = 1448;
export const QAMARI_OLDEST_YEAR = 1395;
export const QAMARI_YEARS: readonly number[] = Array.from(
  { length: QAMARI_NEWEST_YEAR - QAMARI_OLDEST_YEAR + 1 },
  (_, i) => QAMARI_NEWEST_YEAR - i,
);

export const vehicleSchema = z.object({
  brand: z.enum(brandSlugs),
  model: z.string().trim().min(1).max(60),
  trim: z.string().trim().max(60).nullable().default(null),
  year: z.number().int().min(MIN_VEHICLE_YEAR).max(MAX_VEHICLE_YEAR),
  mileageKm: z.number().int().min(0).max(2_000_000),
  gearbox: z.enum(gearboxTypes),
  fuel: z.enum(fuelTypes),
  color: z.enum(colorSlugs),
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

export { vehicleCategories };
