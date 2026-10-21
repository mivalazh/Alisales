import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PALETTE_60_30_10, tokens } from '../src/tokens';

const css = readFileSync(
  fileURLToPath(new URL('../src/tokens.css', import.meta.url)),
  'utf8',
);

function cssValue(varName: string): string | undefined {
  const m = css.match(new RegExp(`--${varName}:\\s*([^;]+);`));
  return m?.[1]?.trim();
}

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('tokens ↔ CSS parity', () => {
  it('has every token declared as a CSS variable with the same value', () => {
    const missing: string[] = [];
    for (const [key, value] of Object.entries(tok)) {
      const inCss = cssValue(key);
      if (inCss !== value) {
        missing.push(`${key}: tokens=${value} css=${inCss ?? '(missing)'}`);
      }
    }
    expect(missing, missing.join('\n')).toEqual([]);
  });

  it('declares no CSS variables that are absent from tokens.ts', () => {
    const declared = [...css.matchAll(/--([a-z0-9_-]+):/gi)].map((m) => m[1]!);
    const orphan = declared.filter((k) => !(k in tok));
    expect(orphan).toEqual([]);
  });
});

const tok = tokens as Record<string, string>;

describe('accessibility contrast checks (WCAG AA ≥ 4.5:1)', () => {
  const pairs: Array<[keyof typeof tokens, keyof typeof tokens]> = [
    ['color-text-primary', 'color-surface'],
    ['color-text-secondary', 'color-surface'],
    ['color-text-tertiary', 'color-surface'],
    ['color-text-primary', 'color-surface-subtle'],
    ['color-text-secondary', 'color-surface-subtle'],
    ['color-text-tertiary', 'color-surface-subtle'],
    ['color-text-inverse', 'color-surface-inverse'],
    ['color-text-on-accent', 'color-accent'],
    ['color-text-on-accent', 'color-accent-hover'],
    ['color-text-on-accent', 'color-accent-soft'],
    ['color-success-fg', 'color-success-bg'],
    ['color-warning-fg', 'color-warning-bg'],
    ['color-danger-fg', 'color-danger-bg'],
    ['color-info-fg', 'color-info-bg'],
  ];

  for (const [fg, bg] of pairs) {
    it(`${fg} on ${bg}`, () => {
      expect(contrast(tok[fg]!, tok[bg]!)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('motion + layout tokens', () => {
  it('bottom sheets animate in 250ms', () => {
    expect(tokens['motion-sheet-duration']).toBe('250ms');
  });
  it('touch targets are at least 44px', () => {
    expect(parseInt(tokens['touch-min'], 10)).toBeGreaterThanOrEqual(44);
  });
  it('photos use a 4:3 aspect ratio token', () => {
    expect(tokens['photo-aspect']).toBe('4 / 3');
  });
});

describe('strict 60-30-10 palette anchors (locked)', () => {
  const tokenValues = new Set(Object.values(tok).map((v) => v.toLowerCase()));

  it('ships the five mandated hexes: ice white, pure white, navy, gray, orange', () => {
    for (const [name, hex] of Object.entries(PALETTE_60_30_10)) {
      expect(tokenValues.has(hex), `${name} ${hex} missing from tokens`).toBe(true);
    }
  });

  it('orange is the single accent, used for CTAs only (navy label passes AA)', () => {
    expect(tok['color-accent']).toBe(PALETTE_60_30_10.accentOrange);
    expect(contrast(tok['color-text-on-accent']!, tok['color-accent']!)).toBeGreaterThanOrEqual(4.5);
    // No legacy blue brand primary should survive the re-scope:
    expect(tokenValues.has('#1450c4')).toBe(false);
  });

  it('60% surfaces are the two neutral whites', () => {
    expect(tok['color-surface']).toBe(PALETTE_60_30_10.pureWhite);
    expect(tok['color-surface-subtle']).toBe(PALETTE_60_30_10.iceWhite);
  });

  it('30% structure uses navy + muted gray', () => {
    expect(tok['color-text-primary']).toBe(PALETTE_60_30_10.navyCharcoal);
    expect(tok['color-text-secondary']).toBe(PALETTE_60_30_10.mutedGray);
    expect(tok['color-surface-inverse']).toBe(PALETTE_60_30_10.navyCharcoal);
  });
});
