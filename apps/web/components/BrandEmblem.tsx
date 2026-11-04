/**
 * Brand emblems for the vehicle brand box.
 *
 * These are deliberately *clean, generic* marks — a monogram inside a
 * brand-shaped outline in the marque's colour — not reproductions of the
 * manufacturers' trademarked logos. Each one reads as its own tile at 48 px and
 * stays crisp at any size because it is plain SVG.
 *
 * `shape` picks the outline family (roundel, shield, wing, ring, hex or
 * swoosh) and `glyph` is the letter(s) drawn inside it.
 */
type Shape = 'roundel' | 'shield' | 'wing' | 'ring' | 'hex' | 'swoosh';

interface EmblemSpec {
  glyph: string;
  ink: string;
  shape: Shape;
}

const EMBLEMS: Record<string, EmblemSpec> = {
  nissan: { glyph: 'N', ink: '#C3002F', shape: 'roundel' },
  toyota: { glyph: 'T', ink: '#EB0A1E', shape: 'ring' },
  'mercedes-benz': { glyph: 'M', ink: '#111111', shape: 'ring' },
  bmw: { glyph: 'B', ink: '#0066B1', shape: 'roundel' },
  porsche: { glyph: 'P', ink: '#B12B28', shape: 'shield' },
  lexus: { glyph: 'L', ink: '#1A1A1A', shape: 'swoosh' },
  hyundai: { glyph: 'H', ink: '#002C5F', shape: 'ring' },
  kia: { glyph: 'K', ink: '#05141F', shape: 'ring' },
  chevrolet: { glyph: 'C', ink: '#D1A21A', shape: 'wing' },
  ford: { glyph: 'F', ink: '#003478', shape: 'ring' },
  dodge: { glyph: 'D', ink: '#B5121B', shape: 'shield' },
  jeep: { glyph: 'J', ink: '#3C4A2E', shape: 'roundel' },
  'land-rover': { glyph: 'LR', ink: '#005A2B', shape: 'shield' },
  mitsubishi: { glyph: 'M', ink: '#E60012', shape: 'hex' },
  honda: { glyph: 'H', ink: '#CC0000', shape: 'swoosh' },
  mazda: { glyph: 'M', ink: '#101010', shape: 'wing' },
  audi: { glyph: 'A', ink: '#BB0A30', shape: 'ring' },
  volkswagen: { glyph: 'V', ink: '#001E50', shape: 'roundel' },
  genesis: { glyph: 'G', ink: '#8C6A3F', shape: 'shield' },
  maserati: { glyph: 'M', ink: '#0C2340', shape: 'hex' },
  other: { glyph: '؟', ink: '#7C5A2E', shape: 'roundel' },
};

export function emblemFor(slug: string): EmblemSpec {
  return EMBLEMS[slug] ?? EMBLEMS.other!;
}

function Outline({ shape, ink }: { shape: Shape; ink: string }) {
  switch (shape) {
    case 'shield':
      return (
        <>
          <path
            d="M24 3.5 42.5 10v13.5c0 8.6-7.3 15.3-18.5 21C12.8 38.8 5.5 32.1 5.5 23.5V10L24 3.5Z"
            fill="none"
            stroke={ink}
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <path d="M13 18h22" stroke={ink} strokeWidth="1.4" opacity="0.45" />
        </>
      );
    case 'wing':
      return (
        <>
          <path
            d="M3 30c7-1.6 13-6.2 16.5-12.4C21 22.9 24 27.6 24 33c0-5.4 3-10.1 4.5-15.4C32 23.8 38 28.4 45 30c-6.6 1.2-12.4 5-16.4 10.2h-9.2C15.4 35 9.6 31.2 3 30Z"
            fill="none"
            stroke={ink}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </>
      );
    case 'hex':
      return (
        <path
          d="M24 3 42 13.5v21L24 45 6 34.5v-21L24 3Z"
          fill="none"
          stroke={ink}
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
      );
    case 'swoosh':
      return (
        <>
          <ellipse cx="24" cy="24" rx="20.5" ry="13" fill="none" stroke={ink} strokeWidth="2.4" />
          <path d="M8 33c6-9 20-13 32-9" fill="none" stroke={ink} strokeWidth="1.6" opacity="0.5" />
        </>
      );
    case 'roundel':
      return (
        <>
          <circle cx="24" cy="24" r="19.5" fill="none" stroke={ink} strokeWidth="2.6" />
          <circle cx="24" cy="24" r="14" fill="none" stroke={ink} strokeWidth="1" opacity="0.4" />
        </>
      );
    case 'ring':
    default:
      return (
        <>
          <ellipse cx="24" cy="24" rx="21" ry="13.5" fill="none" stroke={ink} strokeWidth="2.6" />
          <ellipse cx="24" cy="24" rx="12" ry="6.6" fill="none" stroke={ink} strokeWidth="1.2" opacity="0.45" />
        </>
      );
  }
}

export function BrandEmblem({
  slug,
  size = 44,
  className = '',
}: {
  slug: string;
  size?: number;
  className?: string;
}) {
  const spec = emblemFor(slug);
  // Two-letter marks need a smaller size to stay inside the outline.
  const fontSize = spec.glyph.length > 1 ? 13 : 17;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
    >
      <Outline shape={spec.shape} ink={spec.ink} />
      <text
        x="24"
        y="24"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-sans, system-ui), sans-serif"
        fontSize={fontSize}
        fontWeight="800"
        fill={spec.ink}
        letterSpacing="0.5"
      >
        {spec.glyph}
      </text>
    </svg>
  );
}
