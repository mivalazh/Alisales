import { toAsciiDigits } from './filters';

/**
 * Typo-tolerant search for the marketplace.
 *
 * Buyers type Persian, Latin, or a transliteration of either — «لندکروز»,
 * «لندكروزر», «land cruiser», «لند کروزر» — and often miss a letter. One
 * normalizer plus a small synonym list and a distance fallback covers all of
 * it without a search service: the catalogue is a few hundred rows and the
 * predicate runs on the server and in the client filter preview alike.
 *
 * The module is dependency-free and pure so the same code runs in the Worker,
 * in Node tests and in the browser bundle.
 */

/** Arabic/Persian letter folding + digit folding + lowercase. */
export function normalizeSearchText(input: string): string {
  return toAsciiDigits(input)
    .toLowerCase()
    // Arabic variants → Persian
    .replace(/[يىئ]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[ةۀ]/g, 'ه')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    // diacritics and tatweel
    .replace(/[\u064b-\u0652\u0670\u0640]/g, '')
    // zero-width non-joiner / joiner / BOM
    .replace(/[\u200c\u200d\u200e\u200f\ufeff]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Normalized, punctuation-free form — «Mercedes-Benz» → «mercedesbenz». */
export function compactSearchText(input: string): string {
  return normalizeSearchText(input).replace(/\s+/g, '');
}

/**
 * Cross-script synonyms. Persian/acronym spellings on the left, the Latin
 * model or part word on the right; matching expands a token with the group it
 * belongs to, so «لندکروز» finds a listing whose model is «Land Cruiser».
 */
const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['landcruiser', 'لندکروزر', 'لندکروز'],
  ['landrover', 'لندروور', 'رنجروور', 'رنج روور', 'rangerover'],
  ['patrol', 'پاترول', 'باترول'],
  ['prado', 'پرادو'],
  ['hilux', 'هایلوکس'],
  ['camry', 'کمری'],
  ['corolla', 'کرولا'],
  ['lexus', 'لکسوس'],
  ['mercedes', 'بنز', 'مرسدس', 'مرسدسبنز', 'mercedesbenz'],
  ['bmw', 'بیامو'],
  ['porsche', 'پورش', 'پورشه'],
  ['cayenne', 'کایین', 'کاین', 'کاین'],
  ['macan', 'ماکان'],
  ['audi', 'آئودی', 'اودی'],
  ['volkswagen', 'فولکس', 'فولکسواگن'],
  ['nissan', 'نیسان'],
  ['toyota', 'تویوتا'],
  ['hyundai', 'هیوندای'],
  ['kia', 'کیا'],
  ['ford', 'فورد'],
  ['tesla', 'تسلا'],
  ['brabus', 'برابوس'],
  ['brake', 'لنت', 'ترمز', 'لنتترمز'],
  ['battery', 'باتری'],
  ['engine', 'موتور'],
  ['gearbox', 'گیربکس', 'کلاچ'],
  ['filter', 'فیلتر'],
  ['tire', 'لاستیک', 'تایر'],
  ['oil', 'روغن'],
  ['body', 'بدنه'],
  ['light', 'چراغ'],
  ['turbo', 'توربو', 'توربوشارژ'],
  ['suspension', 'تعلیق', 'کمکفنر'],
  ['original', 'اورجینال', 'اصل', 'oem'],
  ['stock', 'استوک'],
];

/** token → every token it should also match. */
const SYNONYMS: ReadonlyMap<string, readonly string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const group of SYNONYM_GROUPS) {
    const keys = group.map((value) => compactSearchText(value));
    for (const key of keys) {
      const bucket = map.get(key) ?? [];
      for (const other of keys) if (other !== key && !bucket.includes(other)) bucket.push(other);
      map.set(key, bucket);
    }
  }
  return map;
})();

/** Levenshtein distance with an early exit once `max + 1` is exceeded. */
export function levenshtein(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
      current[j] = value;
      if (value < best) best = value;
    }
    if (best > max) return max + 1;
    previous = current;
  }
  return previous[b.length] ?? max + 1;
}

/** Dice coefficient over character trigrams — 1 means identical. */
export function trigramSimilarity(a: string, b: string): number {
  const left = compactSearchText(a);
  const right = compactSearchText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const grams = (value: string): Map<string, number> => {
    const out = new Map<string, number>();
    const padded = ` ${value} `;
    for (let i = 0; i < padded.length - 2; i += 1) {
      const gram = padded.slice(i, i + 3);
      out.set(gram, (out.get(gram) ?? 0) + 1);
    }
    return out;
  };
  const aGrams = grams(left);
  const bGrams = grams(right);
  let overlap = 0;
  for (const [gram, count] of aGrams) overlap += Math.min(count, bGrams.get(gram) ?? 0);
  const total = Math.max(left.length, 1) + Math.max(right.length, 1);
  return (2 * overlap) / total;
}

/** True when `query` is a plausible typo of `word` (1–2 edits by length). */
export function typoMatch(query: string, word: string): boolean {
  const q = compactSearchText(query);
  const w = compactSearchText(word);
  if (!q || !w) return false;
  if (q.length <= 2) return false;
  const allowance = q.length >= 7 ? 2 : 1;
  if (levenshtein(q, w, allowance) <= allowance) return true;
  if (Math.abs(q.length - w.length) <= allowance && w.startsWith(q.slice(0, 2))) {
    return trigramSimilarity(q, w) >= 0.5;
  }
  return false;
}

/** Does one query token hit one text token (or its synonym group)? */
function tokenMatches(queryToken: string, textTokens: readonly string[]): boolean {
  const q = compactSearchText(queryToken);
  if (!q) return true;
  const candidates = new Set<string>([q, ...(SYNONYMS.get(q) ?? [])]);

  for (const raw of textTokens) {
    const token = compactSearchText(raw);
    if (!token) continue;
    for (const candidate of candidates) {
      if (token === candidate) return true;
      if (token.includes(candidate) || candidate.includes(token)) {
        // A short token inside a longer one is only a hit when it is not a
        // single stray character («s» must not match everything).
        if (Math.min(token.length, candidate.length) >= 2) return true;
      }
      if (typoMatch(candidate, token)) return true;
      if (trigramSimilarity(candidate, token) >= 0.58) return true;
    }
  }
  return false;
}

/**
 * Fuzzy, bilingual match of a free-text query against a listing's searchable
 * text. Every query token must hit at least one text token, so extra words
 * narrow the result instead of widening it.
 */
export function fuzzySearchMatch(text: string, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  const textTokens = normalizeSearchText(text).split(' ').filter(Boolean);
  if (textTokens.length === 0) return false;
  // Whole-phrase hit first — «land cruiser» should always find «Land Cruiser».
  if (normalizeSearchText(text).includes(normalizedQuery)) return true;
  return queryTokens.every((token) => tokenMatches(token, textTokens));
}

/** Suggestions for the search panel: normalized prefix/typo hits. */
export function fuzzySuggestions(
  query: string,
  options: readonly string[],
  limit = 6,
): string[] {
  const q = normalizeSearchText(query);
  if (!q) return [];
  const scored: { value: string; score: number }[] = [];
  for (const option of options) {
    const value = normalizeSearchText(option);
    if (!value) continue;
    let score = 0;
    if (value.startsWith(q)) score = 3;
    else if (value.includes(q)) score = 2;
    else if (fuzzySearchMatch(option, query)) score = 1;
    if (score > 0) scored.push({ value: option, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.value.localeCompare(b.value))
    .slice(0, limit)
    .map((item) => item.value);
}
