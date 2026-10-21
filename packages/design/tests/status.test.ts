import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CORE_BADGES, STATUS_BADGES, badgeKeys } from '../src/status';
import { contrast } from './tokens.test';

describe('status badge registry', () => {
  it('covers exactly the five core product badges', () => {
    expect(CORE_BADGES).toEqual([
      'new',
      'used',
      'kish_plate',
      'temporary_transit',
      'verified_report',
    ]);
  });

  it('every badge has a fixed color triple, Persian label and icon token', () => {
    for (const key of badgeKeys) {
      const b = STATUS_BADGES[key];
      expect(b.background, key).toMatch(/^#[0-9a-f]{6}$/);
      expect(b.foreground, key).toMatch(/^#[0-9a-f]{6}$/);
      expect(b.border, key).toMatch(/^#[0-9a-f]{6}$/);
      expect(b.icon, key).toMatch(/^[a-z-]+$/);
      expect(b.label, key).toMatch(/[آ-ی]/); // Persian label
      expect(b.label.trim().length, key).toBeGreaterThan(0);
    }
  });

  it('badge text passes WCAG AA on its own background', () => {
    for (const key of badgeKeys) {
      const b = STATUS_BADGES[key];
      const ratio = contrast(b.foreground, b.background);
      expect(ratio, `${key}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('no two badges share the same color pair (visual distinguishability)', () => {
    const seen = new Map<string, string>();
    for (const key of badgeKeys) {
      const b = STATUS_BADGES[key];
      const pair = `${b.background}|${b.foreground}`;
      const clash = seen.get(pair);
      expect(clash, `${key} clashes with ${clash}`).toBeUndefined();
      seen.set(pair, key);
    }
    expect(seen.size).toBe(badgeKeys.length);
  });

  it('each badge has a unique icon token', () => {
    const icons = badgeKeys.map((k) => STATUS_BADGES[k].icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('CSS mirrors every badge color', () => {
    const css = readFileSync(
      fileURLToPath(new URL('../../design/src/tokens.css', import.meta.url)),
      'utf8',
    );
    for (const key of badgeKeys) {
      const b = STATUS_BADGES[key];
      expect(css).toContain(`--color-badge-${key}-bg: ${b.background}`);
      expect(css).toContain(`--color-badge-${key}-fg: ${b.foreground}`);
      expect(css).toContain(`--color-badge-${key}-border: ${b.border}`);
    }
  });
});
