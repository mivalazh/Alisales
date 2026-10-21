import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LOGO, logoSvgDocument } from '../src/logo';

const logoFile = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../logo/${name}`, import.meta.url)), 'utf8');

describe('brand assets (SVG)', () => {
  const files = ['logo-primary.svg', 'logo-dark.svg', 'logo-symbol.svg', 'favicon.svg'];

  for (const file of files) {
    it(`${file} is a standalone SVG document`, () => {
      const svg = logoFile(file);
      expect(svg).toMatch(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      expect(svg).toContain('viewBox=');
      expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    });

    it(`${file} carries the orange accent (#FF4000)`, () => {
      expect(logoFile(file)).toContain('#FF4000');
    });

    it(`${file} is accessible (role + label)`, () => {
      const svg = logoFile(file);
      expect(svg).toContain('role="img"');
      expect(svg).toContain('aria-label="Alisales');
    });
  }

  it('light lockup uses navy strokes, dark lockup uses white', () => {
    expect(logoFile('logo-primary.svg')).toContain('stroke="#161224"');
    expect(logoFile('logo-dark.svg')).toContain('stroke="#FFFFFF"');
  });

  it('dark lockup has no light-background artifacts (no navy fill on text)', () => {
    expect(logoFile('logo-dark.svg')).not.toContain('fill="#161224"');
  });

  it('app icon is a rounded tile', () => {
    expect(logoFile('logo-symbol.svg')).toMatch(/rx="112"/);
    expect(logoFile('favicon.svg')).toMatch(/rx="14"/);
  });
});

describe('programmatic logo variants', () => {
  it('exposes primary, dark and symbol variants', () => {
    expect(Object.keys(LOGO).sort()).toEqual(['dark', 'primary', 'symbol']);
  });

  it('serializes a valid standalone document', () => {
    const doc = logoSvgDocument(LOGO.symbol);
    expect(doc.startsWith('<svg ')).toBe(true);
    expect(doc).toContain('<title>Alisales</title>');
    expect(doc).toContain('</svg>');
  });

  it('matches the static file geometry', () => {
    const doc = logoSvgDocument(LOGO.primary);
    const file = logoFile('logo-primary.svg');
    expect(doc).toContain(`viewBox="${LOGO.primary.viewBox}"`);
    expect(file).toContain(`viewBox="${LOGO.primary.viewBox}"`);
  });
});
