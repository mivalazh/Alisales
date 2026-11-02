/**
 * Sold badge — carmine red so a sold car still reads instantly over the
 * grayscale photo treatment. Fixed product colors, never theme tokens: the
 * badge keeps its contrast in both themes.
 */
const SOLD_RED = '#d32f2f'; // carmine (≈4.9:1 on white text, WCAG AA)
const SOLD_INK = '#ffffff';

export function SoldBadge({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span
      className={
        size === 'lg'
          ? 'inline-flex items-center px-3.5 py-1 text-sm font-extrabold tracking-wide'
          : 'inline-flex items-center px-2.5 py-1 text-xs font-extrabold tracking-wide'
      }
      style={{
        background: SOLD_RED,
        color: SOLD_INK,
        borderRadius: 8,
        boxShadow: '0 2px 10px rgba(17, 17, 68, 0.35)',
      }}
    >
      Sold
    </span>
  );
}
