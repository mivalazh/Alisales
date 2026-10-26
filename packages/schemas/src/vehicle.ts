import { z } from 'zod';
import { colorSlugs, conditions, fuelTypes, gearboxTypes } from './enums';

/** Market brands (Iran launch). Model stays free text for imports. */
export const BRANDS = [
  { slug: 'saipa', label: 'سایپا', models: ['پراید', 'تیبا', 'کوییک', 'شاهین', 'ساینا'] },
  {
    slug: 'ikco',
    label: 'ایران‌خودرو',
    models: ['پژو ۲۰۶', 'پژو ۲۰۷', 'پژو پارس', 'پژو ۴۰۵', 'دنا', 'دنا پلاس', 'رانا', 'سمند', 'هایما S7'],
  },
  { slug: 'parskhodro', label: 'پارس‌خودرو', models: ['تندر ۹۰', 'ساندرو'] },
  { slug: 'kermankhodro', label: 'کرمان‌خودرو', models: ['جک J4', 'جک S3', 'جک S5', 'آریزو ۵', 'تیگو ۷'] },
  { slug: 'bahman', label: 'بهمن‌موتور', models: ['مزدا ۳', 'بی‌ام‌و ۳۲۰i', 'فولکس‌واگن گل'] },
  { slug: 'kia', label: 'کیا', models: ['سراتو', 'پیکانتو', 'اسپورتیج', 'سورنتو'] },
  { slug: 'hyundai', label: 'هیوندای', models: ['اکسنت', 'النترا', 'سوناتا', 'توسان'] },
  { slug: 'toyota', label: 'تویوتا', models: ['کرولا', 'کمری', 'هاچ', 'RAV4', 'لندکروزر'] },
  { slug: 'renault', label: 'رنو', models: ['مگان', 'فلوئنس', 'کولیوس'] },
  { slug: 'bmw', label: 'بی‌ام‌و', models: ['سری ۳', 'سری ۵', 'X1', 'X3'] },
  { slug: 'mercedes-benz', label: 'مرسدس‌بنز', models: ['کلاس C', 'کلاس E', 'GLC'] },
  { slug: 'chery', label: 'چری', models: ['آریزو ۶', 'تیگو ۸'] },
  { slug: 'mazda', label: 'مزدا', models: ['مزدا ۲', 'مزدا ۳', 'CX-5'] },
  { slug: 'byd', label: 'بی‌ای‌دی', models: ['F0', 'F3', 'S6'] },
  { slug: 'other', label: 'سایر', models: [] },
] as const;

export type BrandSlug = (typeof BRANDS)[number]['slug'];

export const brandSlugs = BRANDS.map((b) => b.slug) as [BrandSlug, ...BrandSlug[]];

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

/** Vehicle model year — Jalali calendar. */
export const MIN_VEHICLE_YEAR = 1300;
export const MAX_VEHICLE_YEAR = 1420;

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
