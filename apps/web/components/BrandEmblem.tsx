/**
 * Brand accent ink.
 *
 * The brand box used to draw an invented "emblem" per marque (a monogram in a
 * made-up outline). That was a substitute for an official logo, so it is gone:
 * the brand tiles now print the Latin marque name in clean typography, and the
 * only thing left here is the deterministic accent colour used by the story
 * rail's gradient rings.
 */
const ACCENT_INKS = [
  '#1F3A93',
  '#B5121B',
  '#0F6B4F',
  '#8C4A1F',
  '#3C2A75',
  '#B07A12',
  '#0E5A73',
  '#7A1E4B',
] as const;

const TUNED: Readonly<Record<string, string>> = {
  toyota: '#EB0A1E',
  nissan: '#C3002F',
  'mercedes-benz': '#111111',
  bmw: '#0066B1',
  porsche: '#B12B28',
  lexus: '#1A1A1A',
  hyundai: '#002C5F',
  kia: '#05141F',
  ford: '#003478',
};

/** The marque's accent ink — used by the story rail's gradient ring. */
export function emblemInk(slug: string | null | undefined): string {
  if (!slug) return '#F98513';
  const tuned = TUNED[slug];
  if (tuned) return tuned;
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return ACCENT_INKS[hash % ACCENT_INKS.length]!;
}
