import { EN_DICTIONARY } from './dictionary';

/**
 * Seller content translator.
 *
 * Structured listing facts are stored as stable keys, but colours, body
 * descriptions, insurance notes, part names and free-text descriptions are
 * typed by people in Persian. The English UI must not drop back into Persian
 * halfway down a card, so this module applies a deterministic automotive
 * phrasebook (longest phrase first), then normalises numbers and punctuation.
 *
 * It is deliberately local and synchronous: no network key, no latency on a
 * catalogue render, and the same string always translates the same way.
 */

const PHRASES: ReadonlyArray<readonly [string, string]> = [
  ['سفید صدفی', 'Pearl white'],
  ['سفید مرواریدی', 'Pearl white'],
  ['مشکی متالیک', 'Metallic black'],
  ['خاکستری متالیک', 'Metallic grey'],
  ['نقره‌ای متالیک', 'Metallic silver'],
  ['آبی نفتی', 'Navy blue'],
  ['آبی روشن', 'Light blue'],
  ['قهوه‌ای روشن', 'Light brown'],
  ['بدون رنگ و بدون تصادف', 'no repaint and no accident history'],
  ['بدون رنگ و تصادف', 'no repaint or accident history'],
  ['بدون رنگ', 'no repaint'],
  ['بدون تصادف', 'no accident history'],
  ['بی‌رنگ (فابریک)', 'factory paint, no repaint'],
  ['بی رنگ (فابریک)', 'factory paint, no repaint'],
  ['بی‌رنگ فابریک', 'factory paint, no repaint'],
  ['بی رنگ فابریک', 'factory paint, no repaint'],
  ['سالم و پلمپ (جلو و عقب)', 'sealed front and rear'],
  ['سالم و پلمپ', 'sealed and undamaged'],
  ['شاسی جلو ضربه/رنگ', 'front chassis repaired'],
  ['شاسی عقب ضربه/رنگ', 'rear chassis repaired'],
  ['دو شاسی ضربه/رنگ', 'both chassis sections repaired'],
  ['شاسی‌بلند', 'SUV'],
  ['شاسی بلند', 'SUV'],
  ['سدان (سواری)', 'sedan'],
  ['سدان', 'sedan'],
  ['هاچ‌بک', 'hatchback'],
  ['هاچ بک', 'hatchback'],
  ['کراس‌اوور', 'crossover'],
  ['کراس اوور', 'crossover'],
  ['کروک / کانورتیبل', 'convertible'],
  ['پیکاپ / وانت', 'pickup'],
  ['دوررنگ', 'partial repaint'],
  ['تمام رنگ', 'full respray'],
  ['تعویض استوک', 'replaced with a used OEM panel'],
  ['یک لکه رنگ', 'one repainted panel'],
  ['چند لکه رنگ', 'a few repainted panels'],
  ['خط و خش جزئی / لیسه', 'minor scratches'],
  ['تصادفی / ضربه‌خورده', 'accident damaged'],
  ['دنده دوکلاچه', 'dual-clutch'],
  ['دنده اتوماتیک', 'automatic'],
  ['دنده دستی', 'manual'],
  ['فول آپشن', 'full options'],
  ['سرویس دوره‌ای', 'scheduled servicing'],
  ['در نمایندگی', 'at the dealership'],
  ['لاستیک و باتری نو', 'new tyres and battery'],
  ['لاستیک نو', 'new tyres'],
  ['باتری نو', 'new battery'],
  ['تک‌مالک', 'single owner'],
  ['تک مالک', 'single owner'],
  ['معاوضه', 'trade-in'],
  ['بررسی می‌شود', 'can be considered'],
  ['بررسی میشود', 'can be considered'],
  ['پلاک کیش', 'Kish plate'],
  ['پلاک منطقه آزاد', 'free-zone plate'],
  ['گذر موقت', 'temporary entry'],
  ['وارداتی', 'imported'],
  ['مدل بالا', 'high specification'],
  ['بدون خط و خش', 'no scratches'],
  ['بدون ضربه', 'no impact damage'],
  ['موتور و گیربکس سالم', 'engine and gearbox are sound'],
  ['شاسی پلمپ', 'chassis is sealed'],
  ['برگه کارشناسی', 'inspection sheet'],
  ['ماه اعتبار', 'months remaining'],
  ['ماه باقی‌مانده', 'months remaining'],
  ['ماه باقی مانده', 'months remaining'],
  ['روز اعتبار', 'days remaining'],
  ['در حد نو', 'excellent condition'],
  ['بسیار تمیز', 'very clean'],
  ['تمیز', 'clean'],
  ['سالم', 'sound'],
  ['پلمپ', 'sealed'],
  ['صفر کیلومتر', 'zero mileage'],
  ['کارکرد واقعی', 'genuine mileage'],
  ['قیمت قابل مذاکره', 'negotiable price'],
  ['قابل مذاکره', 'negotiable'],
  ['تحویل فوری', 'immediate delivery'],
  ['بیمه شخص ثالث', 'third-party insurance'],
  ['بیمه بدنه', 'body insurance'],
  ['معاینه فنی', 'technical inspection'],
  ['دیاگ تخصصی', 'specialist diagnostics'],
  ['نمایشگاه', 'showroom'],
  ['تعمیرگاه', 'workshop'],
  ['فروشنده', 'seller'],
  ['خریدار', 'buyer'],
  ['خودرو', 'vehicle'],
  ['ماشین', 'car'],
  ['موتور', 'engine'],
  ['گیربکس', 'gearbox'],
  ['بدنه', 'body'],
  ['شاسی', 'chassis'],
  ['رنگ', 'paint'],
  ['کیلومتر', 'km'],
  ['تومان', 'Toman'],
  ['درهم', 'AED'],
  ['کیش', 'Kish'],
];

const NAMES_EN: Readonly<Record<string, string>> = {
  'شمس‌اله': 'Shamsollah',
  'شمس اله': 'Shamsollah',
  'شمس‌الله': 'Shamsollah',
  'شمس الله': 'Shamsollah',
  'علی': 'Ali',
  'محمد': 'Mohammad',
  'رضا': 'Reza',
  'حسین': 'Hossein',
  'امیر': 'Amir',
  'مهدی': 'Mehdi',
  'سعید': 'Saeed',
  'مریم': 'Maryam',
  'فاطمه': 'Fatemeh',
  'نمایشگاه': 'Showroom',
  'خودرو': 'Auto',
};

const ZWNJ = '\u200c';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function latinDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const fa = FA_DIGITS.indexOf(digit);
    if (fa >= 0) return String(fa);
    return String(AR_DIGITS.indexOf(digit));
  });
}

function normalize(text: string): string {
  return text
    .replace(/\u064a/g, 'ی')
    .replace(/\u0643/g, 'ک')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Phrases from the shared UI dictionary, longest first. */
const DICTIONARY_PHRASES = Object.entries(EN_DICTIONARY)
  .filter(([fa]) => fa.length >= 3 && /[\u0600-\u06ff]/.test(fa))
  .sort(([a], [b]) => b.length - a.length);

function translateMonths(fragment: string): string {
  const hasMonths = /ماه/.test(fragment);
  const hasDays = /روز/.test(fragment);
  const count = fragment.match(/\d+/)?.[0] ?? '';
  if (!count) return fragment;
  if (hasMonths) return `${count} ${count === '1' ? 'month' : 'months'} remaining`;
  if (hasDays) return `${count} ${count === '1' ? 'day' : 'days'} remaining`;
  return fragment;
}

/**
 * Translate a seller-entered value. Known automotive phrases and UI terms are
 * translated; unknown proper nouns are transliterated only when they are in
 * the small name dictionary, otherwise they are preserved rather than
 * corrupted. Numbers always become Latin digits.
 */
export function translateListingContentToEn(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';

  let text = normalize(latinDigits(raw));
  if (!/[\u0600-\u06ff]/.test(text)) return text;

  // Insurance: «دارد (۱۰ ماه اعتبار)» → «Yes (10 months remaining)».
  text = text.replace(
    /دارد\s*\(([^)]*?(?:ماه|روز)[^)]*)\)/g,
    (_match, inside: string) => `Yes (${translateMonths(inside)})`,
  );
  text = text.replace(/(\d+)\s*ماه\s*(?:اعتبار|باقی[‌ ]?مانده)?/g, (_m, n: string) =>
    `${n} ${n === '1' ? 'month' : 'months'} remaining`,
  );

  for (const [fa, en] of PHRASES) {
    if (text.includes(fa)) text = text.split(fa).join(en);
  }

  // Shared labels cover the remaining structured values (colours, body
  // classes, insurance, part categories and common interface nouns).
  for (const [fa, en] of DICTIONARY_PHRASES) {
    if (text.includes(fa)) text = text.split(fa).join(en);
  }

  for (const [fa, en] of Object.entries(NAMES_EN)) {
    if (text.includes(fa)) text = text.split(fa).join(en);
  }

  text = text
    .replace(/،/g, ',')
    .replace(/؛/g, ';')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();

  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** True when a string still contains Persian/Arabic letters after translation. */
export function hasPersianText(value: string): boolean {
  return /[\u0600-\u06ff]/.test(value);
}
