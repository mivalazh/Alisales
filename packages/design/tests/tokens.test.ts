import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  badgeTag,
  cssTokenName,
  dark,
  legacyColors,
  light,
  neutral,
  palette,
  statusTag,
  tokens,
} from '../src/tokens';

const css = readFileSync(
  fileURLToPath(new URL('../src/tokens.css', import.meta.url)),
  'utf8',
);

/* ─────────────────────────── helpers ─────────────────────────── */

function block(selectorPattern: string): string {
  const m = css.match(new RegExp(`${selectorPattern}\\s*\\{([^}]*)\\}`));
  return m?.[1] ?? '';
}

function varsOf(source: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of source.matchAll(/--([a-z][a-z0-9-]*)\s*:\s*([^;]+);/gi)) {
    out.set(m[1]!.toLowerCase(), m[2]!.trim());
  }
  return out;
}

/** `:root` (light) block — the `[data-theme]` selector never matches `:root\s*{`. */
const rootVars = varsOf(block(':root'));
const darkVars = varsOf(block(`:root\\[data-theme='dark'\\]`));

function cssValue(varName: string): string | undefined {
  return rootVars.get(varName);
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

const PALETTE_AND_NEUTRAL = new Set<string>([
  ...Object.values(palette),
  neutral.white,
]);

function isHex(value: string): boolean {
  return /^#[0-9a-f]{3,8}$/i.test(value);
}

function collectColorValues(): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(palette)) rows.push([`palette.${k}`, v]);
  rows.push(['neutral.white', neutral.white]);
  for (const [k, v] of Object.entries(light)) rows.push([`light.${k}`, v]);
  for (const [k, v] of Object.entries(dark)) rows.push([`dark.${k}`, v]);
  for (const [k, v] of Object.entries(statusTag)) {
    rows.push([`statusTag.${k}.bg`, v.bg]);
    rows.push([`statusTag.${k}.text`, v.text]);
  }
  for (const [k, v] of Object.entries(legacyColors)) rows.push([`legacy.${k}`, v]);
  return rows.filter(([, v]) => isHex(v));
}

/* ─────────────── rule 3: no color outside the palette ─────────────── */

describe('palette purity (rule: no color outside Palette A)', () => {
  it('locks the approved Palette A hexes', () => {
    expect(palette).toEqual({
      lusterWhite: '#F4F1EC',
      asterFlowerBlue: '#9BACD8',
      habanero: '#F98513',
      jodhpurTan: '#DAD1C8',
      deepSpaceRoyal: '#223382',
      deadlyDepths: '#111144',
    });
    expect(neutral.white).toBe('#FFFFFF'); // approved single neutral exception
  });

  it('every color value in tokens.ts belongs to the palette (+ neutral.white)', () => {
    const offenders = collectColorValues().filter(
      ([, v]) => !PALETTE_AND_NEUTRAL.has(v.toUpperCase()),
    );
    expect(offenders, offenders.map(([k, v]) => `${k}=${v}`).join('\n')).toEqual([]);
  });

  it('every hex declared in tokens.css belongs to the palette (+ neutral.white)', () => {
    const hexes = [...css.matchAll(/#[0-9a-f]{3,8}/gi)].map((m) => m[0]);
    const offenders = hexes.filter((h) => !PALETTE_AND_NEUTRAL.has(h.toUpperCase()));
    expect([...new Set(offenders)], [...new Set(offenders)].join('\n')).toEqual([]);
  });

  it('lists EVERY usage of neutral.white (approved: light cards + label on navy CTA)', () => {
    const lightUsages = Object.entries(light)
      .filter(([, v]) => v === neutral.white)
      .map(([k]) => `light.${k}`)
      .sort();
    expect(lightUsages).toEqual(['light.onPrimaryAction', 'light.surface']);

    const darkUsages = Object.entries(dark)
      .filter(([, v]) => (v as string) === (neutral.white as string))
      .map(([k]) => `dark.${k}`);
    expect(darkUsages).toEqual([]);

    const statusUsages = Object.entries(statusTag).flatMap(([k, pair]) =>
      ([pair.bg, pair.text] as readonly string[]).includes(neutral.white)
        ? [`statusTag.${k}`]
        : [],
    );
    expect(statusUsages).toEqual([]);

    const legacyUsages = Object.entries(legacyColors)
      .filter(([, v]) => v === neutral.white)
      .map(([k]) => `legacy.${k}`)
      .sort();
    expect(legacyUsages).toEqual(['legacy.color-surface', 'legacy.color-text-on-accent']);

    const cssUsages = [...rootVars.entries()]
      .filter(([, v]) => v.toLowerCase() === neutral.white.toLowerCase())
      .map(([k]) => `--${k}`)
      .sort();
    expect(cssUsages).toEqual([
      '--color-surface',
      '--color-text-on-accent',
      '--neutral-white',
      '--on-primary-action',
      '--surface',
    ]);
  });
});

/* ─────────────────────── tokens ↔ CSS parity ─────────────────────── */

describe('tokens ↔ CSS parity', () => {
  it('light: every canonical key exists in :root with the same value', () => {
    const missing: string[] = [];
    for (const [key, value] of Object.entries(light)) {
      const inCss = cssValue(cssTokenName(key));
      if (inCss !== value) missing.push(`${key}: tokens=${value} css=${inCss ?? '(missing)'}`);
    }
    expect(missing, missing.join('\n')).toEqual([]);
  });

  it('dark: the dark block declares exactly the dark keys, same values', () => {
    const missing: string[] = [];
    for (const [key, value] of Object.entries(dark)) {
      const inCss = darkVars.get(cssTokenName(key));
      if (inCss !== value) missing.push(`${key}: tokens=${value} css=${inCss ?? '(missing)'}`);
    }
    const lightKebabKeys = new Set(Object.keys(light).map(cssTokenName));
    const extras = [...darkVars.keys()].filter((k) => !lightKebabKeys.has(k));
    expect(missing, missing.join('\n')).toEqual([]);
    expect(extras, extras.join('\n')).toEqual([]);
  });

  it('statusTag: every pair mirrors --status-tag-* in :root', () => {
    for (const [key, pair] of Object.entries(statusTag)) {
      const kebab = cssTokenName(key);
      expect(cssValue(`status-tag-${kebab}-bg`), `${key}.bg`).toBe(pair.bg);
      expect(cssValue(`status-tag-${kebab}-text`), `${key}.text`).toBe(pair.text);
    }
  });

  it('legacy --color-* vars mirror the transitional legacyColors view', () => {
    const missing: string[] = [];
    for (const [key, value] of Object.entries(legacyColors)) {
      const inCss = cssValue(key);
      if (inCss !== value) missing.push(`${key}: tokens=${value} css=${inCss ?? '(missing)'}`);
    }
    expect(missing, missing.join('\n')).toEqual([]);
  });

  it('structural tokens (spacing/radii/type/motion/layout/price) mirror CSS', () => {
    for (const [key, value] of Object.entries(tokens)) {
      if (key in legacyColors) continue;
      expect(cssValue(key), key).toBe(value);
    }
  });

  it('declares no CSS variables that are unknown to tokens.ts', () => {
    const known = new Set<string>([
      'neutral-white',
      ...Object.keys(light).map(cssTokenName),
      ...Object.keys(dark).map(cssTokenName),
      ...Object.keys(statusTag).flatMap((k) => [
        `status-tag-${cssTokenName(k)}-bg`,
        `status-tag-${cssTokenName(k)}-text`,
      ]),
      ...Object.keys(legacyColors),
      ...Object.keys(tokens).filter((k) => !(k in legacyColors)),
    ]);
    const declared = new Set([...rootVars.keys(), ...darkVars.keys()]);
    const orphan = [...declared].filter((k) => !known.has(k));
    expect(orphan, orphan.join('\n')).toEqual([]);
  });
});

/* ─────────── rule 1: text/background pairs ≥ 4.5 (both modes) ─────────── */

describe('WCAG AA — text/background pairs ≥ 4.5:1 (both modes)', () => {
  type Pair = [keyof typeof light, keyof typeof light];

  const lightPairs: Pair[] = [
    ['text', 'bg'],
    ['text', 'surface'],
    ['text', 'surfaceMuted'],
    ['text', 'softAccent'],
    ['textMuted', 'bg'],
    ['textMuted', 'surface'],
    ['textMuted', 'softAccent'],
    ['price', 'surface'],
    ['price', 'bg'],
    ['onPrimaryAction', 'primaryAction'],
    ['onPrimaryAction', 'primaryActionHover'],
    ['onPlusButton', 'plusButton'],
    ['navActive', 'bg'],
    ['navActive', 'surface'],
    ['navInactive', 'bg'],
    ['navInactive', 'surface'],
  ];

  const darkPairs: Pair[] = [
    ['text', 'bg'],
    ['text', 'surface'],
    ['text', 'softAccent'],
    ['textMuted', 'bg'],
    ['textMuted', 'surface'],
    ['textMuted', 'softAccent'],
    ['price', 'surface'],
    ['price', 'bg'],
    ['onPrimaryAction', 'primaryAction'],
    ['onPrimaryAction', 'primaryActionHover'],
    ['onPlusButton', 'plusButton'],
    ['navActive', 'bg'],
    ['navActive', 'surface'],
    ['navInactive', 'bg'],
    ['navInactive', 'surface'],
  ];

  for (const [fg, bg] of lightPairs) {
    it(`light · ${fg} on ${bg}`, () => {
      expect(contrast(light[fg], light[bg])).toBeGreaterThanOrEqual(4.5);
    });
  }

  for (const [fg, bg] of darkPairs) {
    it(`dark · ${fg} on ${bg}`, () => {
      expect(contrast(dark[fg], dark[bg])).toBeGreaterThanOrEqual(4.5);
    });
  }
});

/* ── rule 2: form-control borders + focus rings ≥ 3:1 (constructions) ── */

describe('WCAG AA — borders, focus rings, button edges ≥ 3:1', () => {
  it('light · borderControl on every light background', () => {
    for (const bg of [light.bg, light.surface, light.softAccent] as const) {
      expect(contrast(light.borderControl, bg), bg).toBeGreaterThanOrEqual(3);
    }
  });

  it('dark · borderControl on every dark background', () => {
    for (const bg of [dark.bg, dark.surface, dark.softAccent] as const) {
      expect(contrast(dark.borderControl, bg), bg).toBeGreaterThanOrEqual(3);
    }
  });

  it('light · focus ring #223382 on every light surface', () => {
    for (const bg of [light.bg, light.surface, light.softAccent] as const) {
      expect(contrast(light.focusRing, bg), bg).toBeGreaterThanOrEqual(3);
    }
  });

  it('light · navy button focus = 2px offset ring: ring↔gap and gap↔button ≥ 3', () => {
    // The ring must never touch the same-color button: outline-offset shows gap.
    expect(contrast(light.focusRing, light.bg)).toBeGreaterThanOrEqual(3); // ring vs page
    expect(contrast(light.bg, light.primaryAction)).toBeGreaterThanOrEqual(3); // gap vs button
    expect(contrast(light.focusRing, light.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(light.surface, light.primaryAction)).toBeGreaterThanOrEqual(3);
  });

  it('light · orange button focus ring = #111144 with 2px offset (approved)', () => {
    const ring = palette.deadlyDepths;
    expect(contrast(ring, light.plusButton)).toBeGreaterThanOrEqual(3); // ring vs habanero
    expect(contrast(ring, light.bg)).toBeGreaterThanOrEqual(3); // ring vs page
    expect(contrast(ring, light.surface)).toBeGreaterThanOrEqual(3); // ring vs white card
  });

  it('dark · focus ring #F98513 on every dark surface', () => {
    for (const bg of [dark.bg, dark.surface, dark.softAccent] as const) {
      expect(contrast(dark.focusRing, bg), bg).toBeGreaterThanOrEqual(3);
    }
  });

  it('dark · orange button focus = #F98513 ring on #111144 gap (approved)', () => {
    const gap = palette.deadlyDepths;
    expect(contrast(dark.focusRing, gap)).toBeGreaterThanOrEqual(3); // ring vs gap
    expect(contrast(gap, dark.primaryAction)).toBeGreaterThanOrEqual(3); // gap vs button
    expect(contrast(gap, dark.plusButton)).toBeGreaterThanOrEqual(3); // gap vs plus
  });

  it('light · primary navy CTA edge separates from both backgrounds (no border needed)', () => {
    expect(contrast(light.primaryAction, light.bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(light.primaryAction, light.surface)).toBeGreaterThanOrEqual(3);
  });

  it('dark · habanero CTA edge separates from both backgrounds (no border needed)', () => {
    expect(contrast(dark.primaryAction, dark.bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(dark.primaryAction, dark.surface)).toBeGreaterThanOrEqual(3);
  });

  it('light · plus button gets the approved #223382 border ≥ 3:1 everywhere', () => {
    const border = light.borderControl; // deepSpaceRoyal
    expect(contrast(border, light.plusButton)).toBeGreaterThanOrEqual(3); // border vs fill
    expect(contrast(border, light.bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(border, light.surface)).toBeGreaterThanOrEqual(3);
  });

  it('dark · plus button fill separates on its own ≥ 3:1 (no border)', () => {
    expect(contrast(dark.plusButton, dark.bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(dark.plusButton, dark.surface)).toBeGreaterThanOrEqual(3);
  });
});

/* ─────────── rule 4: statusTag pairs ≥ 4.5 ─────────── */

describe('statusTag pairs ≥ 4.5:1', () => {
  for (const [key, pair] of Object.entries(statusTag)) {
    it(`${key} — text on bg`, () => {
      expect(contrast(pair.text, pair.bg)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('dark-card price #F98513 on #223382 stays ≥ 4.5:1 (decision: keep it there)', () => {
    expect(contrast(dark.price, dark.surface)).toBeGreaterThanOrEqual(4.5);
  });
});

/* ─────────────── price display + motion/layout rules ─────────────── */

describe('price display + motion + layout tokens', () => {
  it('price text is weight 500 and ≥ 16px (dark-card rule)', () => {
    expect(tokens['price-font-weight']).toBe('500');
    expect(parseInt(tokens['price-font-size'], 10)).toBeGreaterThanOrEqual(16);
  });

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

/* ─────────────── legacy view sanity (transitional) ─────────────── */

describe('transitional legacy view', () => {
  it('primary CTA maps to navy and the plus button to habanero', () => {
    expect(legacyColors['color-accent']).toBe(palette.deepSpaceRoyal);
    expect(legacyColors['color-accent-hover']).toBe(palette.deadlyDepths);
    expect(light.primaryAction).toBe(palette.deepSpaceRoyal);
    expect(light.plusButton).toBe(palette.habanero);
    expect(dark.primaryAction).toBe(palette.habanero);
  });

  it('semantic trio stays inside the palette (never color alone in UI)', () => {
    expect(legacyColors['color-warning-bg']).toBe(palette.habanero);
    expect(legacyColors['color-warning-fg']).toBe(palette.deadlyDepths);
    expect(legacyColors['color-danger-fg']).toBe(palette.deadlyDepths);
    expect(legacyColors['color-success-fg']).toBe(palette.deepSpaceRoyal);
    // warning pair must itself pass AA (habanero bg + depths text)
    expect(
      contrast(legacyColors['color-warning-fg'], legacyColors['color-warning-bg']),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('every badge maps onto a statusTag pair (no badge may invent colors)', () => {
    for (const tag of Object.values(badgeTag)) {
      expect(statusTag[tag], tag).toBeDefined();
    }
    expect(new Set(Object.values(badgeTag)).size).toBeLessThanOrEqual(
      Object.keys(statusTag).length,
    );
  });
});
